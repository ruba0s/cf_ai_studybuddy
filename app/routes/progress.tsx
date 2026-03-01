import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';

export function meta() {
  return [
    { title: 'Study Buddy — Progress' },
    { name: 'description', content: 'Track your study progress and memory strength.' },
  ];
}

interface ProgressResponse {
  totalQuestions: number;
  totalMaterials: number;
  dueNow: number;
  dueUpcoming: number;
  masteredCount: number;
  averageEaseFactor: number;
  questionsByDifficulty: Record<'easy' | 'medium' | 'hard', number>;
}

type PageStatus = 'idle' | 'loading' | 'ready' | 'error';

function normalizeDifficulties(
  raw: Record<string, number>
): Record<'easy' | 'medium' | 'hard', number> {
  return {
    easy:   raw['easy']   ?? 0,
    medium: raw['medium'] ?? 0,
    hard:   raw['hard']   ?? 0,
  };
}

export default function ProgressPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<PageStatus>('idle');
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const refresh = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const raw = await api.getProgress() as ProgressResponse & {
        questionsByDifficulty: Record<string, number>;
      };
      setData({
        ...raw,
        questionsByDifficulty: normalizeDifficulties(raw.questionsByDifficulty ?? {}),
      });
      setStatus('ready');
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Failed to load progress');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  if (status === 'idle' || status === 'loading') return <LoadingView />;
  if (status === 'error') return <ErrorView message={errorMsg} onRetry={refresh} />;
  if (!data || data.totalQuestions === 0) return <EmptyState onUpload={() => navigate('/')} />;

  const masteryPercent =
    data.totalQuestions > 0 ? Math.round((data.masteredCount / data.totalQuestions) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Progress</h1>
      </div>

      <MasteryProgressBar
        masteredCount={data.masteredCount}
        totalQuestions={data.totalQuestions}
        masteryPercent={masteryPercent}
        dueNow={data.dueNow}
        onStartReview={() => navigate('/quiz')}
      />

      <StatsGrid data={data} />

      <DifficultyDistribution
        questionsByDifficulty={data.questionsByDifficulty}
        totalQuestions={data.totalQuestions}
      />

      <div className="flex gap-3">
        <button
          onClick={() => navigate('/quiz')}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue Studying
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Upload New Material
        </button>
      </div>
    </div>
  );
}

function MasteryProgressBar({
  masteredCount,
  totalQuestions,
  masteryPercent,
  dueNow,
  onStartReview,
}: {
  masteredCount: number;
  totalQuestions: number;
  masteryPercent: number;
  dueNow: number;
  onStartReview: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Mastery</span>
          <span className="ml-2 text-sm text-gray-400 font-mono">{masteredCount}/{totalQuestions}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900 font-mono">{masteryPercent}%</span>
          {dueNow > 0 && (
            <button
              onClick={onStartReview}
              className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-full hover:bg-red-600 transition-colors"
            >
              {dueNow} due · Review now
            </button>
          )}
        </div>
      </div>
      <div
        className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={masteryPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Mastery progress: ${masteryPercent}%`}
      >
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${masteryPercent}%` }}
        />
      </div>
    </div>
  );
}

function StatsGrid({ data }: { data: ProgressResponse }) {
  const efLabel =
    data.averageEaseFactor >= 2.8 ? 'Strong' :
    data.averageEaseFactor >= 2.2 ? 'Good' : 'Needs work';

  const stats: { label: string; value: string | number; sub?: string; accent?: boolean }[] = [
    { label: 'Total Questions', value: data.totalQuestions },
    { label: 'Study Materials', value: data.totalMaterials },
    { label: 'Due Today', value: data.dueNow, accent: data.dueNow > 0 },
    { label: 'Due Soon', value: data.dueUpcoming, sub: 'next 7 days' },
    { label: 'Avg Memory Strength', value: data.averageEaseFactor.toFixed(2), sub: efLabel },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stats.map(({ label, value, sub, accent }) => (
        <div
          key={label}
          className={`rounded-xl border p-4 shadow-sm ${
            accent ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
          }`}
        >
          <div className={`text-2xl font-mono font-semibold ${accent ? 'text-red-600' : 'text-gray-900'}`}>
            {value}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-1">{label}</div>
          {sub && <div className="text-xs text-gray-400 italic mt-0.5">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

function DifficultyDistribution({
  questionsByDifficulty,
  totalQuestions,
}: {
  questionsByDifficulty: Record<'easy' | 'medium' | 'hard', number>;
  totalQuestions: number;
}) {
  const tiers: { key: 'easy' | 'medium' | 'hard'; label: string; color: string }[] = [
    { key: 'easy',   label: 'Easy',   color: 'bg-green-500' },
    { key: 'medium', label: 'Medium', color: 'bg-yellow-500' },
    { key: 'hard',   label: 'Hard',   color: 'bg-red-500' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Difficulty Breakdown
      </h3>
      <div className="space-y-3">
        {tiers.map(({ key, label, color }) => {
          const count = questionsByDifficulty[key] ?? 0;
          const pct = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;
          return (
            <div key={key} className="grid grid-cols-[56px_1fr_32px] items-center gap-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div
                className="h-2 bg-gray-100 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label}: ${count} questions`}
              >
                <div
                  className={`h-full ${color} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm text-gray-400 font-mono text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <div className="text-5xl">📭</div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Nothing to track yet</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          Upload study material to start building your knowledge base. Your progress will appear here.
        </p>
      </div>
      <button
        onClick={onUpload}
        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Upload Material
      </button>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Spinner className="w-10 h-10 text-blue-500" />
      <p className="text-gray-500 text-sm">Loading your progress...</p>
    </div>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-red-600 text-sm">{message || 'Failed to load progress'}</p>
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

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? 'w-8 h-8'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}