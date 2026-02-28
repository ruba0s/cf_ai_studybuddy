import { DurableObject } from "cloudflare:workers";
import { defaultCard, updateCard, isDue } from '../lib/sm2';
import type { SM2Card, Quality } from '../lib/sm2';

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface Env {
    AI: Ai;
    QUIZ_SESSION: DurableObjectNamespace;
    DOCUMENT_PROCESSOR: Workflow;
}

interface Material {
    id: string;
    content: string;
    filename: string;
    uploadedAt: number;
}

interface Question {
    id: string;
    materialId: string;
    question: string;
    answer: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

export class QuizSession extends DurableObject<Env> {
    private db: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.db = ctx.storage.sql;
        this.initSchema();
    }

    private initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS materials (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                filename TEXT NOT NULL,
                uploaded_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                material_id TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                difficulty TEXT NOT NULL DEFAULT 'medium'
            );

            CREATE TABLE IF NOT EXISTS sm2_cards (
                question_id TEXT PRIMARY KEY,
                ease_factor REAL NOT NULL DEFAULT 2.5,
                interval_days INTEGER NOT NULL DEFAULT 1,
                repetitions INTEGER NOT NULL DEFAULT 0,
                next_review INTEGER NOT NULL
            );
        `);
    }

    // TODO: called by DocumentProcessor Workflow after generating questions
    async storeGeneratedQuestions(
      materialId: string,
      materialContent: string,
      filename: string,
      questions: Array<{ question: string; answer: string; difficulty: string }>
    ): Promise<{ stored: number }> {
      // store the material
      this.db.exec(
        `INSERT OR REPLACE INTO materials (id, content, filename, uploaded_at) VALUES (?, ?, ?, ?)`,
        materialId,
        materialContent,
        filename,
        Date.now()
      );

      let stored = 0;
      for (const q of questions) {
        const questionId = crypto.randomUUID();
        const card = defaultCard();

        // explicitly coerce all values (DO SQLite is strict about undefined)
        const difficulty = ['easy', 'medium', 'hard'].includes(q.difficulty)
          ? q.difficulty
          : 'medium'; // default to medium for invalid difficulties

        this.db.exec(
          `INSERT INTO questions (id, material_id, question, answer, difficulty) 
          VALUES (?, ?, ?, ?, ?)`,
          String(questionId),
          String(materialId),
          String(q.question),
          String(q.answer),
          String(difficulty)
        );

        this.db.exec(
          `INSERT INTO sm2_cards (question_id, ease_factor, interval_days, repetitions, next_review)
          VALUES (?, ?, ?, ?, ?)`,
          String(questionId),
          Number(card.easeFactor),
          Number(card.interval),
          Number(card.repetitions),
          Number(card.nextReview)
        );

        stored++;
      }

      return { stored };
    }

    // get the next due question (SM-2 scheduled), or a random new one
    async getNextQuestion(): Promise<{ question: Question; card: SM2Card } | null> {
        const now = Date.now();

        // look for overdue questions
        const due = this.db.exec(
            `SELECT q.*, c.ease_factor, c.interval_days, c.repetitions, c.next_review
            FROM questions q
            JOIN sm2_cards c ON q.id = c.question_id
            WHERE c.next_review <= ?
            ORDER BY c.next_review ASC
            LIMIT 1`,
            now
        ).toArray();

        // fallback: get any question (for first-time sessions)
        const row =
            due.length > 0
            ? due[0]
            : this.db.exec(
                `SELECT q.*, c.ease_factor, c.interval_days, c.repetitions, c.next_review
                FROM questions q
                JOIN sm2_cards c ON q.id = c.question_id
                ORDER BY RANDOM()
                Limit 1`
            ).toArray()[0];

        if (!row) return null;

        const question: Question = {
            id: row.id as string,
            materialId: row.material_id as string,
            question: row.question as string,
            answer: row.answer as string,
            difficulty: row.difficulty as Question['difficulty'],
        };

        const card: SM2Card = {
            easeFactor: row.ease_factor as number,
            interval: row.interval_days as number,
            repetitions: row.repetitions as number,
            nextReview: row.next_review as number,
        };

        return { question, card };
    }

    // evaluate user answer and update SM-2
    async evaluateAnswer(
        questionId: string,
        userAnswer: string
    ): Promise<{ correct: boolean; quality: Quality; feedback: string; updatedCard: SM2Card }> {
        // get question
        const rows = this.db.exec(`SELECT * FROM questions WHERE id = ?`, questionId).toArray();

        if (rows.length === 0) throw new Error('Question not found');
        const q = rows[0];

        // get current SM-2 card
        const cardRows = this.db
            .exec(`SELECT * FROM sm2_cards WHERE question_id = ?`, questionId)
            .toArray();

        if (cardRows.length === 0) throw new Error('SM-2 card not found');
        const cardRow = cardRows[0];

        const currentCard: SM2Card = {
            easeFactor: cardRow.ease_factor as number,
            interval: cardRow.interval_days as number,
            repetitions: cardRow.repetitions as number,
            nextReview: cardRow.next_review as number,
        };

        // User Workers AI to evaluate the answer
        const evalPrompt = `You are grading a student's answer.
            Question: ${q.question}
            Correct answer: ${q.answer}
            Student's answer: ${userAnswer}

        Evaluate the student's answer and respond with ONLY valid JSON in this exact format:
          {
            "quality": <number 0-5>,
            "correct": <true or false>,
            "feedback": "<one sentence of feedback as is relevant to the material topic and question>"
          }

        Quality scale: 0=complete blackout, 1=wrong, 2=wrong but familiar, 3=correct with difficulty, 4=correct with hesitation, 5=perfect`;

        const aiResponse = await this.env.AI.run(MODEL_ID, {
          messages: [{ role: 'user', content: evalPrompt }],
          max_tokens: 150,
        });

        let quality: Quality = 3;
        let correct = false;
        let feedback = 'Answer evaluated.';

        try {
          const aiResult = aiResponse as { response: unknown };
          let evalData: { quality: number; correct: boolean; feedback: string } | null = null;

          // Case 1: response is already a parsed object
          if (typeof aiResult.response === 'object' && aiResult.response !== null && !Array.isArray(aiResult.response)) {
            evalData = aiResult.response as unknown as typeof evalData;
          }
          // Case 2: response is a JSON string
          else if (typeof aiResult.response === 'string') {
            try {
              const match = aiResult.response.match(/\{[\s\S]*\}/);
              if (match) evalData = JSON.parse(match[0]);
            } catch { /* fall through to fallback */ }
          }

          if (evalData) {
            quality = Math.min(5, Math.max(0, Math.round(evalData.quality))) as Quality;
            correct = evalData.correct === true;
            feedback = evalData.feedback || feedback;
          }
        } catch {
          // fallback: simple string match
          const normalize = (s: string) => s.toLowerCase().trim();
          correct = normalize(userAnswer).includes(normalize(q.answer as string).slice(0, 20));
          quality = correct ? 4 : 1;
        }

        // Update SM-2
        const updatedCard = updateCard(currentCard, quality);

        this.db.exec(
          `UPDATE sm2_cards
          SET ease_factor = ?, interval_days = ?, repetitions = ?, next_review = ?
          WHERE question_id = ?`,
          updatedCard.easeFactor,
          updatedCard.interval,
          updatedCard.repetitions,
          updatedCard.nextReview,
          questionId
        );

        return { correct, quality, feedback, updatedCard };
    }

  // Progress stats
  async getProgress(): Promise<{
    totalQuestions: number;
    totalMaterials: number;
    dueNow: number;
    averageEaseFactor: number;
    questionsByDifficulty: Record<string, number>;
  }> {
    const now = Date.now();

    const total = (this.db.exec(`SELECT COUNT(*) as count FROM questions`).toArray()[0]?.count as number) ?? 0;
    const materials = (this.db.exec(`SELECT COUNT(*) as count FROM materials`).toArray()[0]?.count as number) ?? 0;
    const due = (this.db.exec(`SELECT COUNT(*) as count FROM sm2_cards WHERE next_review <= ?`, now).toArray()[0]?.count as number) ?? 0;
    const avgEF = (this.db.exec(`SELECT AVG(ease_factor) as avg FROM sm2_cards`).toArray()[0]?.avg as number) ?? 2.5;

    const diffRows = this.db
      .exec(`SELECT difficulty, COUNT(*) as count FROM questions GROUP BY difficulty`)
      .toArray();

    const questionsByDifficulty: Record<string, number> = {};
    for (const row of diffRows) {
      questionsByDifficulty[row.difficulty as string] = row.count as number;
    }

    return {
      totalQuestions: total,
      totalMaterials: materials,
      dueNow: due,
      averageEaseFactor: Math.round(avgEF * 100) / 100,
      questionsByDifficulty,
    };
  }

  // HTTP handler — Hono routes call fetch() on the DO stub
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/store-questions' && request.method === 'POST') {
        const body = await request.json() as {
          materialId: string;
          materialContent: string;
          filename: string;
          questions: Array<{ question: string; answer: string; difficulty: string }>;
        };
        const result = await this.storeGeneratedQuestions(
          body.materialId,
          body.materialContent,
          body.filename,
          body.questions
        );
        return Response.json(result);
      }

      if (url.pathname === '/next-question' && request.method === 'GET') {
        const result = await this.getNextQuestion();
        return Response.json(result);
      }

      if (url.pathname === '/evaluate' && request.method === 'POST') {
        const body = await request.json() as { questionId: string; answer: string };
        const result = await this.evaluateAnswer(body.questionId, body.answer);
        return Response.json(result);
      }

      if (url.pathname === '/progress' && request.method === 'GET') {
        const result = await this.getProgress();
        return Response.json(result);
      }

      // Match /material-status/<materialId> to get material's upload status
      const statusMatch = url.pathname.match(/^\/material-status\/([^/]+)$/);
      if (statusMatch && request.method === 'GET') {
        const materialId = statusMatch[1];
        const result = await this.getMaterialStatus(materialId);
        return Response.json(result);
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 500 });
    }
  }
  
  async getMaterialStatus(materialId: string): Promise<{
    materialExists: boolean;
    questionCount: number;
    status: 'pending' | 'ready';
  }> {
    const materialRows = this.db
      .exec(`SELECT id FROM materials WHERE id = ?`, materialId)
      .toArray();

    if (materialRows.length === 0) {
      return { materialExists: false, questionCount: 0, status: 'pending' };
    }

    const countRow = this.db
      .exec(`SELECT COUNT(*) as count FROM questions WHERE material_id = ?`, materialId)
      .toArray()[0];

    const questionCount = (countRow?.count as number) ?? 0;

    return {
      materialExists: true,
      questionCount,
      status: questionCount > 0 ? 'ready' : 'pending',
    };
  }
}