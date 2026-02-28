// worker API endpoints
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { QuizSession } from './durable-objects/QuizSession';
import { DocumentProcessor } from './workflows/DocumentProcessor';
import { createRequestHandler } from "react-router";
import mammoth from 'mammoth';

export { QuizSession, DocumentProcessor };  // required for Cloudflare to find them

export interface Env {
  AI: Ai;
  QUIZ_SESSION: DurableObjectNamespace;   // reference to QuizSession DO namespace
  DOCUMENT_PROCESSOR: Workflow;           // reference to DocumentProcessor Workflow
  ASSETS: Fetcher;                        // binding for Cloudflare Pages integration 
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// helper function to get DO stub from sessionId header
function getSessionStub(c: { req: { header: (k: string) => string | undefined }; env: Env }) {
  const sessionId = c.req.header('x-session-id');
  if (!sessionId) throw new Error('Missing x-session-id header');
  const doId = c.env.QUIZ_SESSION.idFromName(sessionId);
  return c.env.QUIZ_SESSION.get(doId);
}

// POST /api/upload
// Body: { filename: string, content: string }
// Header: x-session-id
app.post('/api/upload', async (c) => {
  try {
    const sessionId = c.req.header('x-session-id');
    if (!sessionId) return c.json({ error: 'Missing x-session-id' }, 400);

    const { filename, content, isBase64 } = await c.req.json<{
      filename: string;
      content: string;
      isBase64: boolean;
    }>();

    if (!content?.trim()) return c.json({ error: 'No content provided' }, 400);

    let extractedText: string;

    if (isBase64) {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext !== 'docx') {
        return c.json({ error: 'Base64 upload only supported for .docx' }, 400);
      }

      // Decode base64 → ArrayBuffer
      const binaryStr = atob(content);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
      extractedText = result.value?.trim();

      if (!extractedText) {
        return c.json({ error: 'Could not extract text from DOCX' }, 422);
      }
    } else {
      extractedText = content;
    }

    const materialId = crypto.randomUUID();

    await c.env.DOCUMENT_PROCESSOR.create({
      params: {
        sessionId,
        materialId,
        filename: filename || 'untitled.txt',
        content: extractedText,
      },
    });

    return c.json({ materialId, status: 'processing' });
  } catch (err) {
    console.error('Upload error:', err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/status/:materialId
// Header: x-session-id
app.get('/api/status/:materialId', async (c) => {
  try {
    const stub = getSessionStub(c as any);
    const materialId = c.req.param('materialId');
    const res = await stub.fetch(`https://do-internal/material-status/${materialId}`);
    const data = await res.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/quiz/next
// Header: x-session-id
app.get('/api/quiz/next', async (c) => { // get next quiz question
  try {
    const stub = getSessionStub(c as any);
    const res = await stub.fetch('https://do-internal/next-question'); // '/next-question' endpoint in QuizSession DO
    const data = await res.json();

    return c.json(data);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// POST /api/quiz/answer
// Body: { questionId: string, answer: string }
// Header: x-session-id
app.post('/api/quiz/answer', async (c) => { // user submits answer, evaluate and give feedback
  try {
    const stub = getSessionStub(c as any);
    const body = await c.req.json();
    const res = await stub.fetch('https://do-internal/evaluate', { // forward to QuizSession DO's '/evalute'
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return c.json(data); // return eval/feedback
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/progress
// Header: x-session-id
app.get('/api/progress', async (c) => { // get user's overall quiz progress stats
  try {
    const stub = getSessionStub(c as any);
    const res = await stub.fetch('https://do-internal/progress');
    const data = await res.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Fallthrough to Pages assets
// TODO: frontend
app.get("*", (c) => {
	const requestHandler = createRequestHandler(
		() => import("virtual:react-router/server-build"),
		import.meta.env.MODE,
	);

	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

export default app;