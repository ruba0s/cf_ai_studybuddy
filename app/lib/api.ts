const getSessionId = (): string => {
  let id = localStorage.getItem('studybuddy_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('studybuddy_session_id', id);
  }
  return id;
};

export const api = {
  upload: async (filename: string, content: string, isBase64: boolean) => {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': getSessionId(),
      },
      body: JSON.stringify({ filename, content, isBase64 }),
    });
    const data = await res.json() as { materialId?: string; status?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
    return data as { materialId: string; status: string };
  },

  getNextQuestion: async () => {
    const res = await fetch('/api/quiz/next', {
      headers: { 'x-session-id': getSessionId() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to get question');
    return data;
  },

  submitAnswer: async (questionId: string, answer: string) => {
    const res = await fetch('/api/quiz/answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': getSessionId(),
      },
      body: JSON.stringify({ questionId, answer }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to submit answer');
    return data;
  },

  getProgress: async () => {
    const res = await fetch('/api/progress', {
      headers: { 'x-session-id': getSessionId() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to get progress');
    return data;
  },
};