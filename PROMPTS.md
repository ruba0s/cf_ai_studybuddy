# AI Prompts Used
**Model used:** Claude Sonnet 4.6

## 1. Worker Utility Scaffolding
**File(s):** `workers/lib/sm2.ts`, `workers/lib/chunker.ts`

**Prompt:**
> Create two utility modules for a Cloudflare Worker:
> 1. A pure TypeScript implementation of the SM-2 spaced repetition algorithm
>    with types for SM2Card and Quality (0-5 scale), defaultCard(), updateCard(),
>    and isDue() functions.
> 2. A text chunker that splits study material into ~500-token chunks with overlap,
>    breaking on paragraph/sentence boundaries where possible.
>
> These should have no Cloudflare-specific dependencies.

---

## 2. Workers AI JSON Response Parsing
**File(s):** `workers/workflows/DocumentProcessor.ts`

**Prompt:**
> The Workers AI binding for llama-3.3-70b-instruct-fp8-fast is returning
> { response: [...], tool_calls: [], usage: {} } where response is already
> a parsed array, not a string. My regex-based JSON extraction is failing.
> How should I handle this response format robustly with a string fallback?

---

## 3. Answer Evaluation Response Handling
**File:** `workers/durable-objects/QuizSession.ts`

**Prompt:**
> My evaluateAnswer() method sends a grading prompt to Workers AI expecting
> { quality, correct, feedback } JSON back. The same response format issue
> applies here, the model may return a parsed object or a JSON string.
> What's the cleanest way to handle both cases with a simple string-match
> fallback if parsing fails entirely?

---

## 4. Understanding Durable Objects SQL Storage
**File(s):** `workers/durable-objects/QuizSession.ts`

**Prompt:**
> Explain how SQL storage works within Cloudflare Durable Objects. I thought
> the whole point of Durable Objects was that they provide shared state without
> relying on a traditional database layer?

---

## 5. File Upload Component
**File(s):** `app/components/FileUpload.tsx`

**Prompt:**
> Create a TypeScript React file upload component that POSTs to /api/upload
> with a session ID header, handles idle/uploading/processing/success/error
> states, validates file type (.txt, .pdf, .docx) and size (max 10MB), and
> persists sessionId in localStorage.

---

## 6. useQuiz Hook
**File(s):** `app/hooks/useQuiz.ts`

**Prompt:**
> Create a custom React hook in TypeScript for managing quiz state: fetching
> questions from /api/quiz/next, submitting answers to /api/quiz/answer, and
> handling loading, feedback, and error states.

---

## 7. Quiz Page Component
**File(s):** `app/routes/quiz.tsx`

**Prompt:**
> Build a state-driven React quiz page that integrates with the useQuiz hook,
> renders question/feedback/finished/error views, and handles focus management
> and accessibility.


---

## 8. Progress Page Component
**File(s):** `app/routes/progress.tsx`

**Prompt:**
> Create a strongly-typed React progress page that fetches from /api/progress, displays
> mastery stats and difficulty distribution, and handles loading and error states.
