import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuiz } from '../hooks/useQuiz';

export default function QuizPage() {
  const quiz = useQuiz();
  const navigate = useNavigate();

  useEffect(() => {
    quiz.loadNextQuestion();
  }, [quiz.loadNextQuestion]);

  switch (quiz.status) {
    case 'idle':
    case 'loading':
      return <LoadingView />;
    case 'showing-question':
    case 'submitting':
      return (
        <QuestionView
          question={quiz.currentQuestion}
          isSubmitting={quiz.status === 'submitting'}
          onSubmit={quiz.submitAnswer}
          onViewProgress={() => navigate('/progress')}
        />
      );
    case 'showing-feedback':
      return (
        <FeedbackView
          feedback={quiz.feedback}
          card={quiz.currentCard}
          onNext={() => {
            quiz.resetFeedback();
            quiz.loadNextQuestion();
          }}
        />
      );
    case 'session-complete':
      return (
        <div className="flex flex-col items-center gap-6 mt-16">
          <svg className="w-16 h-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800">You're all caught up!</h2>
          <p className="text-sm text-gray-500">No cards are due right now. Come back later, or keep reviewing older cards.</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              Done for now
            </button>
            <button
              onClick={quiz.loadRandomOldCard}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              Keep reviewing
            </button>
          </div>
        </div>
      );
    case 'finished':
      return <FinishedView onRetry={quiz.loadNextQuestion} />;
    case 'error':
      return <ErrorView error={quiz.error} onRetry={quiz.loadNextQuestion} />;
  }
}

function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Spinner className="w-12 h-12 text-blue-500" />
      <p className="text-gray-600">Loading your next question...</p>
    </div>
  );
}

interface QuestionViewProps {
  question: { id: string; question: string; difficulty: 'easy' | 'medium' | 'hard' } | null;
  isSubmitting: boolean;
  onSubmit: (answer: string) => Promise<void>;
  onViewProgress: () => void;
}

function QuestionView({ question, isSubmitting, onSubmit, onViewProgress }: QuestionViewProps) {
  const [answer, setAnswer] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setAnswer('');
    textareaRef.current?.focus();
  }, [question?.id]);

  if (!question) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const isDisabled = isSubmitting;
  const canSubmit = answer.trim().length > 0 && !isDisabled;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <DifficultyBadge difficulty={question.difficulty} />
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-6">{question.question}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
              Your Answer
            </label>
            <textarea
              ref={textareaRef}
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={isDisabled}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-500 resize-none"
              placeholder="Type your answer here..."
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting && <Spinner className="w-4 h-4" />}
            {isSubmitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        </form>

        <button
          type="button"
          onClick={onViewProgress}
          className="w-full mt-3 px-6 py-2 text-sm text-gray-700 bg-blue-300 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          View Progress
        </button>

      </div>
    </div>
  );
}

interface FeedbackViewProps {
  feedback: { correct: boolean; quality: number; feedback: string } | null;
  card: { easeFactor: number; interval: number; repetitions: number; nextReview: number } | null;
  onNext: () => void;
}

function FeedbackView({ feedback, card, onNext }: FeedbackViewProps) {
  if (!feedback || !card) return null;

  const nextReviewDate = new Date(card.nextReview);
  const formattedDate = nextReviewDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col items-center gap-4 mb-6">
          {feedback.correct ? (
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          <div className="text-center">
            <h3 className={`text-2xl font-bold ${feedback.correct ? 'text-green-600' : 'text-red-600'}`}>
              {feedback.correct ? 'Correct!' : 'Incorrect'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">Quality Score: {feedback.quality}/5</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-gray-700">{feedback.feedback}</p>
        </div>

        <div className="space-y-2 mb-6 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Repetitions:</span>
            <span className="font-medium">{card.repetitions}</span>
          </div>
          <div className="flex justify-between">
            <span>Interval:</span>
            <span className="font-medium">{card.interval} {card.interval === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="flex justify-between">
            <span>Next Review:</span>
            <span className="font-medium">{formattedDate}</span>
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Next Question
        </button>
      </div>
    </div>
  );
}

function FinishedView({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="text-6xl">🎉</div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all caught up!</h2>
        <p className="text-gray-600">No questions are due right now.</p>
      </div>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Check Again
      </button>
    </div>
  );
}

function ErrorView({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-red-600">{error || 'An unknown error occurred'}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
  const styles = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-pink-100 text-pink-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${styles[difficulty]}`}>
      {difficulty}
    </span>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className || 'w-8 h-8'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}