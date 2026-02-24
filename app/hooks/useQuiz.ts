// app/hooks/useQuiz.ts
import { useState, useCallback } from 'react';
import { api } from '../lib/api';

type QuizStatus =
  | 'idle'
  | 'loading'
  | 'showing-question'
  | 'submitting'
  | 'showing-feedback'
  | 'finished'
  | 'error';

interface Question {
  id: string;
  materialId: string;
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface SM2Card {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
}

interface Feedback {
  correct: boolean;
  quality: number;
  feedback: string;
}

interface UseQuizReturn {
  status: QuizStatus;
  currentQuestion: Question | null;
  currentCard: SM2Card | null;
  feedback: Feedback | null;
  error: string | null;
  loadNextQuestion: () => Promise<void>;
  submitAnswer: (answer: string) => Promise<void>;
  resetFeedback: () => void;
}

export function useQuiz(): UseQuizReturn {
  const [status, setStatus] = useState<QuizStatus>('idle');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentCard, setCurrentCard] = useState<SM2Card | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNextQuestion = useCallback(async () => {
    try {
      setStatus('loading');
      setError(null);

      const data = await api.getNextQuestion();

      // No questions available
      if (data === null || data.question === null) {
        setStatus('finished');
        setCurrentQuestion(null);
        setCurrentCard(null);
        return;
      }

      // Validate response shape
      if (!data.question?.id || !data.question?.question || !data.card) {
        throw new Error('Invalid question data received');
      }

      setCurrentQuestion(data.question);
      setCurrentCard(data.card);
      setStatus('showing-question');
    } catch (err) {
      setError((err as Error).message ?? 'Failed to load question');
      setStatus('error');
    }
  }, []);

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!currentQuestion) {
        setError('No question loaded');
        setStatus('error');
        return;
      }

      try {
        setStatus('submitting');
        setError(null);

        const data = await api.submitAnswer(currentQuestion.id, answer);

        // Validate response
        if (
          typeof data.correct !== 'boolean' ||
          typeof data.quality !== 'number' ||
          !data.feedback ||
          !data.updatedCard
        ) {
          throw new Error('Invalid answer response');
        }

        setFeedback({
          correct: data.correct,
          quality: data.quality,
          feedback: data.feedback,
        });
        setCurrentCard(data.updatedCard);
        setStatus('showing-feedback');
      } catch (err) {
        setError((err as Error).message ?? 'Failed to submit answer');
        setStatus('error');
      }
    },
    [currentQuestion]
  );

  const resetFeedback = useCallback(() => {
    setFeedback(null);
    setStatus('showing-question');
  }, []);

  return {
    status,
    currentQuestion,
    currentCard,
    feedback,
    error,
    loadNextQuestion,
    submitAnswer,
    resetFeedback,
  };
}