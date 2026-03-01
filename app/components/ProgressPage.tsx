import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';

interface ProgressResponse {
  totalQuestions: number;
  totalMaterials: number;
  dueNow: number;
  dueUpcoming: number;
  masteredCount: number;
  averageEaseFactor: number;
  questionsByDifficulty: Record<'easy' | 'medium' | 'hard', number>;
}

interface DerivedStats {
  masteryPercent: number;   // 0–100
  reviewPressure: number;   // 0–100
}

type PageStatus = 'loading' | 'ready' | 'error';

// derived values
function deriveStats(data: ProgressResponse): DerivedStats {
  const total = data.totalQuestions;
  return {
    masteryPercent: total > 0 ? Math.round((data.masteredCount / total) * 100) : 0,
    reviewPressure: total > 0 ? Math.round((data.dueNow / total) * 100) : 0,
  };
}

interface MasteryProgressBarProps {
  masteredCount: number;
  totalQuestions: number;
  masteryPercent: number;
  dueNow: number;
  loading: boolean;
  onStartReview: () => void;
}

function MasteryProgressBar({
  masteredCount,
  totalQuestions,
  masteryPercent,
  dueNow,
  loading,
  onStartReview,
}: MasteryProgressBarProps) {
  return (
    <div className="mastery-header">
      <div className="mastery-text-row">
        <div className="mastery-label-group">
          <span className="mastery-title">Mastery</span>
          <span className="mastery-fraction">{masteredCount}/{totalQuestions}</span>
        </div>
        <div className="mastery-right">
          <span className="mastery-percent">{masteryPercent}%</span>
          {dueNow > 0 && (
            <button
              className="review-btn review-btn--urgent"
              onClick={onStartReview}
              disabled={loading}
              aria-label={`Start review — ${dueNow} cards due`}
            >
              <span className="review-btn__dot" />
              {dueNow} due · Review now
            </button>
          )}
        </div>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={masteryPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Mastery progress: ${masteryPercent}%`}
      >
        <div
          className="progress-fill"
          style={{ width: `${masteryPercent}%` }}
        />
        {/* review pressure overlay */}
        <div
          className="progress-pressure"
          style={{ width: `${Math.min(masteryPercent + 6, 100)}%`, opacity: dueNow > 0 ? 1 : 0 }}
        />
      </div>
    </div>
  );
}

// stats grid
interface StatCardProps {
  label: string;
  value: number | string;
  accent?: boolean;
  sublabel?: string;
}

function StatCard({ label, value, accent, sublabel }: StatCardProps) {
  return (
    <div className={`stat-card ${accent ? 'stat-card--accent' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {sublabel && <span className="stat-sublabel">{sublabel}</span>}
    </div>
  );
}

interface StatsGridProps {
  data: ProgressResponse;
}

function StatsGrid({ data }: StatsGridProps) {
  // averageEaseFactor: 1.3 = weak, 2.5 = default, 3.0+ = strong
  const efLabel =
    data.averageEaseFactor >= 2.8
      ? 'Strong'
      : data.averageEaseFactor >= 2.2
      ? 'Good'
      : 'Needs work';

  return (
    <div className="stats-grid">
      <StatCard label="Total Questions" value={data.totalQuestions} />
      <StatCard label="Study Materials" value={data.totalMaterials} />
      <StatCard
        label="Due Today"
        value={data.dueNow}
        accent={data.dueNow > 0}
      />
      <StatCard label="Due Soon" value={data.dueUpcoming} sublabel="next 7 days" />
      <StatCard
        label="Avg Memory Strength"
        value={data.averageEaseFactor.toFixed(2)}
        sublabel={efLabel}
      />
    </div>
  );
}

// ─── Difficulty Distribution ──────────────────────────────────────────────────

interface DifficultyDistributionProps {
  questionsByDifficulty: Record<'easy' | 'medium' | 'hard', number>;
  totalQuestions: number;
}

const DIFFICULTY_META: Record<'easy' | 'medium' | 'hard', { label: string; colorClass: string }> = {
  easy:   { label: 'Easy',   colorClass: 'bar--easy' },
  medium: { label: 'Medium', colorClass: 'bar--medium' },
  hard:   { label: 'Hard',   colorClass: 'bar--hard' },
};

function DifficultyDistribution({ questionsByDifficulty, totalQuestions }: DifficultyDistributionProps) {
  const tiers = (['easy', 'medium', 'hard'] as const);

  return (
    <div className="difficulty-section">
      <h3 className="section-title">Difficulty Breakdown</h3>
      <div className="difficulty-bars">
        {tiers.map((tier) => {
          const count = questionsByDifficulty[tier] ?? 0;
          const pct = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;
          const meta = DIFFICULTY_META[tier];
          return (
            <div key={tier} className="diff-row">
              <span className="diff-label">{meta.label}</span>
              <div
                className="diff-track"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${meta.label}: ${count} questions`}
              >
                <div
                  className={`diff-fill ${meta.colorClass}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="diff-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onUpload: () => void;
}

function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">📭</div>
      <h2 className="empty-title">Nothing to track yet</h2>
      <p className="empty-body">
        Upload study material to start building your knowledge base.
        Your progress will appear here once you have cards.
      </p>
      <button className="action-btn action-btn--primary" onClick={onUpload}>
        Upload material
      </button>
    </div>
  );
}

// error view
interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div className="error-state">
      <span className="error-icon" aria-hidden="true">⚠</span>
      <p className="error-message">{message}</p>
      <button className="action-btn action-btn--ghost" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

// main progress page
export default function Progress() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchProgress = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const sessionId = localStorage.getItem('session-id') ?? '';
      const res = await fetch('/api/progress', {
        headers: { 'x-session-id': sessionId },
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json: ProgressResponse = await res.json();
      setData(json);
      setStatus('ready');
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Failed to load progress');
      setStatus('error');
    }
  }, []);

  // Public refresh handle (can be called from parent via ref if needed)
  const refresh = useCallback(() => fetchProgress(), [fetchProgress]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const loading = status === 'loading';

  return (
    <>
      <style>{CSS}</style>
      <div className="progress-page">
        {/* ── Header ── */}
        <header className="page-header">
          <div className="header-left">
            <h1 className="page-title">Progress</h1>
            <button
              className="refresh-btn"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh progress"
            >
              <svg
                className={`refresh-icon ${loading ? 'refresh-icon--spinning' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Mastery bar lives in header when data is ready */}
          {status === 'ready' && data && data.totalQuestions > 0 && (
            <MasteryProgressBar
              masteredCount={data.masteredCount}
              totalQuestions={data.totalQuestions}
              masteryPercent={deriveStats(data).masteryPercent}
              dueNow={data.dueNow}
              loading={loading}
              onStartReview={() => navigate('/quiz')}
            />
          )}
        </header>

        {/* ── Body ── */}
        <main className="page-body">
          {status === 'loading' && (
            <div className="skeleton-stack" aria-busy="true" aria-label="Loading progress">
              <div className="skeleton skeleton--wide" />
              <div className="skeleton-row">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton skeleton--card" />
                ))}
              </div>
              <div className="skeleton skeleton--medium" />
            </div>
          )}

          {status === 'error' && (
            <ErrorView message={errorMsg} onRetry={refresh} />
          )}

          {status === 'ready' && data && (
            <>
              {data.totalQuestions === 0 ? (
                <EmptyState onUpload={() => navigate('/')} />
              ) : (
                <div className="content-stack">
                  <StatsGrid data={data} />
                  <DifficultyDistribution
                    questionsByDifficulty={data.questionsByDifficulty}
                    totalQuestions={data.totalQuestions}
                  />

                  {/* ── Actions ── */}
                  <div className="actions-row">
                    <button
                      className="action-btn action-btn--primary"
                      onClick={() => navigate('/quiz')}
                      disabled={loading}
                    >
                      Continue Studying
                    </button>
                    <button
                      className="action-btn action-btn--ghost"
                      onClick={() => navigate('/')}
                      disabled={loading}
                    >
                      Upload Material
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600&display=swap');

  :root {
    --bg:           #f5f3ef;
    --surface:      #fdfcfa;
    --border:       #e5e1d8;
    --text-primary: #1c1a17;
    --text-muted:   #7a7469;
    --accent:       #c84b31;
    --accent-light: #fce9e4;
    --green:        #2d7a4f;
    --green-light:  #e3f5ec;
    --amber:        #b45309;
    --amber-light:  #fef3cd;
    --blue:         #1d4ed8;
    --blue-light:   #eff6ff;
    --radius:       10px;
    --shadow:       0 1px 3px rgba(0,0,0,.07), 0 4px 12px rgba(0,0,0,.04);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .progress-page {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    min-height: 100vh;
    color: var(--text-primary);
  }

  /* ── Header ── */
  .page-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 20px 28px 0;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .page-title {
    font-family: 'Instrument Serif', serif;
    font-size: 1.75rem;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .refresh-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-muted);
    border-radius: 6px;
    display: flex;
    align-items: center;
    transition: color .15s, background .15s;
  }
  .refresh-btn:hover:not(:disabled) { color: var(--text-primary); background: var(--border); }
  .refresh-btn:disabled { opacity: .4; cursor: not-allowed; }

  .refresh-icon { width: 16px; height: 16px; }
  .refresh-icon--spinning { animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Mastery block ── */
  .mastery-header {
    padding-bottom: 18px;
  }

  .mastery-text-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mastery-label-group {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .mastery-title {
    font-size: .75rem;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .mastery-fraction {
    font-family: 'DM Mono', monospace;
    font-size: .8rem;
    color: var(--text-muted);
  }

  .mastery-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mastery-percent {
    font-family: 'DM Mono', monospace;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  /* ── Review button ── */
  .review-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: .78rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: transform .1s, box-shadow .1s;
  }
  .review-btn:active:not(:disabled) { transform: scale(.97); }
  .review-btn:disabled { opacity: .5; cursor: not-allowed; }

  .review-btn--urgent {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 2px 8px rgba(200,75,49,.35);
  }
  .review-btn--urgent:hover:not(:disabled) {
    box-shadow: 0 4px 14px rgba(200,75,49,.45);
  }

  .review-btn__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,.7);
    animation: pulse-dot 1.5s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: .5; transform: scale(.7); }
  }

  /* ── Progress track ── */
  .progress-track {
    position: relative;
    height: 6px;
    background: var(--border);
    border-radius: 99px;
    overflow: hidden;
  }

  .progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--green);
    border-radius: 99px;
    transition: width .6s cubic-bezier(.4,0,.2,1);
  }

  .progress-pressure {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--accent);
    opacity: 0;
    border-radius: 99px;
    mix-blend-mode: multiply;
    transition: width .6s cubic-bezier(.4,0,.2,1), opacity .3s;
  }

  /* ── Page body ── */
  .page-body {
    padding: 28px;
    max-width: 860px;
    margin: 0 auto;
  }

  .content-stack {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* ── Stats Grid ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--shadow);
    transition: transform .15s;
  }
  .stat-card:hover { transform: translateY(-1px); }

  .stat-card--accent {
    background: var(--accent-light);
    border-color: #f0b8ac;
  }

  .stat-value {
    font-family: 'DM Mono', monospace;
    font-size: 1.6rem;
    font-weight: 500;
    line-height: 1;
    color: var(--text-primary);
  }

  .stat-card--accent .stat-value { color: var(--accent); }

  .stat-label {
    font-size: .72rem;
    font-weight: 600;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .stat-sublabel {
    font-size: .7rem;
    color: var(--text-muted);
    font-style: italic;
  }

  /* ── Difficulty section ── */
  .difficulty-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
  }

  .section-title {
    font-size: .72rem;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .difficulty-bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .diff-row {
    display: grid;
    grid-template-columns: 56px 1fr 32px;
    align-items: center;
    gap: 12px;
  }

  .diff-label {
    font-size: .8rem;
    font-weight: 500;
    color: var(--text-muted);
  }

  .diff-track {
    height: 8px;
    background: var(--border);
    border-radius: 99px;
    overflow: hidden;
  }

  .diff-fill {
    height: 100%;
    border-radius: 99px;
    transition: width .5s cubic-bezier(.4,0,.2,1);
  }

  .bar--easy   { background: var(--green); }
  .bar--medium { background: var(--amber); }
  .bar--hard   { background: var(--accent); }

  .diff-count {
    font-family: 'DM Mono', monospace;
    font-size: .78rem;
    color: var(--text-muted);
    text-align: right;
  }

  /* ── Actions ── */
  .actions-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 10px 22px;
    border-radius: 8px;
    font-size: .875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: transform .1s, box-shadow .1s, background .15s;
    font-family: 'DM Sans', sans-serif;
  }
  .action-btn:active:not(:disabled) { transform: scale(.97); }
  .action-btn:disabled { opacity: .45; cursor: not-allowed; }

  .action-btn--primary {
    background: var(--text-primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,.2);
  }
  .action-btn--primary:hover:not(:disabled) {
    background: #2e2b27;
    box-shadow: 0 4px 14px rgba(0,0,0,.25);
  }

  .action-btn--ghost {
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .action-btn--ghost:hover:not(:disabled) { background: var(--bg); }

  /* ── Skeletons ── */
  .skeleton-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .skeleton-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
  }

  .skeleton {
    background: var(--border);
    border-radius: var(--radius);
    animation: shimmer 1.4s ease-in-out infinite;
  }
  .skeleton--wide   { height: 56px; }
  .skeleton--card   { height: 96px; }
  .skeleton--medium { height: 160px; }

  @keyframes shimmer {
    0%, 100% { opacity: 1; }
    50% { opacity: .45; }
  }

  /* ── Empty / Error states ── */
  .empty-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 24px;
    text-align: center;
  }

  .empty-icon { font-size: 3rem; }
  .empty-title {
    font-family: 'Instrument Serif', serif;
    font-size: 1.4rem;
    font-weight: 400;
    color: var(--text-primary);
  }
  .empty-body {
    font-size: .875rem;
    color: var(--text-muted);
    max-width: 320px;
    line-height: 1.6;
  }

  .error-icon  { font-size: 2rem; color: var(--accent); }
  .error-message {
    font-size: .875rem;
    color: var(--text-muted);
    max-width: 300px;
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .page-header { padding: 16px 16px 0; }
    .page-body   { padding: 16px; }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .skeleton-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .mastery-text-row { flex-direction: column; align-items: flex-start; }
    .actions-row { flex-direction: column; }
    .action-btn { width: 100%; text-align: center; }
  }
`;