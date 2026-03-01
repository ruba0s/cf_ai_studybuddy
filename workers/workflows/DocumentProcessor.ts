// DocumentProcessor Workflow — processes study files and generates quiz questions using llama 3.3 AI model
// (runs as a durable, resumable background job on Cloudflare's infrastructure)
import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import { chunkText } from '../lib/chunker';

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface Env {
  AI: Ai;
  QUIZ_SESSION: DurableObjectNamespace;
}

export interface DocumentProcessorParams { // input data when the workflow starts
  sessionId: string;    // unique ID for this study session
  materialId: string;
  filename: string;
  content: string;
}

interface GeneratedQuestion {
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export class DocumentProcessor extends WorkflowEntrypoint<Env, DocumentProcessorParams> {
  async run(event: WorkflowEvent<DocumentProcessorParams>, step: WorkflowStep) {
    const { sessionId, materialId, filename, content } = event.payload;

    // chunk the document
    const chunks = await step.do('chunk-document', async () => {
      return chunkText(content);
    });

    // generate questions from each chunk (in parallel)
    const chunksToProcess = chunks.slice(0, 3); // limit for cost/speed (process only the first 3 chunks)

    const allQuestions: GeneratedQuestion[] = [];

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];

      const questions = await step.do(`generate-questions-chunk-${i}`, async () => {
        const prompt = `You are a study assistant. Generate quiz questions from the following text.

        Text:
        ${chunk.text}

        Generate 3-5 questions that test understanding of key concepts. Mix difficulties.
        Respond with ONLY a valid JSON array, no other text:
        [
          {
            "question": "...",
            "answer": "...",
            "difficulty": "easy" | "medium" | "hard"
          }
        ]`;

        const rawResponse = await this.env.AI.run(MODEL_ID, {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
        }) as { response: unknown; tool_calls?: unknown[]; usage?: unknown };

        // parse AI response
        // The model returns questions directly as a JSON array in the response field
        const responseField = rawResponse.response;

        let questionsArray: GeneratedQuestion[] | null = null;

        // response is already a parsed array
        if (Array.isArray(responseField)) {
          questionsArray = responseField as GeneratedQuestion[];
        }
        // response is a JSON string containing an array
        else if (typeof responseField === 'string') {
          try {
            const parsed = JSON.parse(responseField);
            if (Array.isArray(parsed)) {
              questionsArray = parsed;
            } else {
              // string might have the array embedded, regex fallback
              const match = responseField.match(/\[\s*\{[\s\S]*?"difficulty"[\s\S]*?\}\s*\]/);
              if (match) questionsArray = JSON.parse(match[0]);
            }
          } catch {
            console.error('[Workflow] String parse failed:', responseField.slice(0, 100));
          }
        }

        if (!questionsArray) return [];

        const filtered = questionsArray.filter(
          (q) => q.question && q.answer && ['easy', 'medium', 'hard'].includes(q.difficulty)
        );
        return filtered;
          });

      allQuestions.push(...(questions as GeneratedQuestion[]));
    }

    // store everything in the DO
    await step.do('store-in-durable-object', async () => {
      // get the DO stub for this session
      const doId = this.env.QUIZ_SESSION.idFromName(sessionId);
      const stub = this.env.QUIZ_SESSION.get(doId);

      const response = await stub.fetch('https://do-internal/store-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          materialContent: content,
          filename,
          questions: allQuestions,
        }),
      });

      if (!response.ok) {
        throw new Error(`DO store failed: ${await response.text()}`);
      }

      return { stored: allQuestions.length };
    });

    return { questionsGenerated: allQuestions.length };
  }
}