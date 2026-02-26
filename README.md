# AskMyNotes

AskMyNotes is a full-stack SaaS web app for subject-scoped note Q&A and study generation.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn-style UI components + Framer Motion
- MongoDB + Mongoose
- Email/password auth with bcrypt + JWT httpOnly cookies
- Local file uploads under `data/uploads`
- PDF/TXT parsing, chunking, embeddings, retrieval gating
- Demo Mode (no external LLM calls) with extractive answering/study generation
- Persistent light/dark mode toggle
- Voice input with browser speech recognition and recorder-based server transcription fallback

## Features Required by Hackathon Spec

- Exactly 3 subjects per user (enforced in UI + API + DB slot constraint)
- Subject-scoped retrieval and chat (strict by `subjectId`)
- Strict Not Found answer: `Not found in your notes for [SubjectName]`
- Response contract includes confidence, citations, and top evidence snippets
- Study mode per subject:
  - Difficulty levels: Easy / Medium / Hard
  - 5 MCQs (4 options + correct option + explanation)
  - 3 short-answer Qs + model answers
  - 10 interactive flashcards (exam unlock)
  - citations + evidence for all generated items
  - exam-first flow: answer questions first, then submit to check marks/answers
  - regenerate produces a fresh question set each time
- YouTube URL ingestion per subject (caption-based transcript import)
- AI Lab per subject:
  - 6 key concepts
  - 8 flashcards
  - 3-day revision plan
  - answer coach (score + improved notes-grounded answer)
- Productivity Boost per subject:
  - smart semantic search over notes
  - concept explainer (one-liner / simple / exam-ready)
  - time-boxed study planner
- Spaced Repetition per subject:
  - auto-generated memory cards from note chunks
  - due queue with Again / Hard / Good / Easy ratings
  - interval/ease scheduling for daily revision
  - reviewed-today and next-due tracking
- Test checking and marks:
  - Submit MCQ + short answers
  - API checks answers and returns marks, percentage, and per-question feedback

## 1) Docker Quickstart

```bash
docker compose up --build
```

App: [http://localhost:3000](http://localhost:3000)

Docker services started:
- `web` (Next.js app)
- `mongodb` (MongoDB)
- Persistent volumes:
  - `mongo_data`
  - `uploads_data` (mounted to `/app/data/uploads`)

On startup in Docker, a seed script creates demo user:
- Email: `demo@askmynotes.com`
- Password: `Demo@1234`

## 2) Local Dev Quickstart

```bash
npm install
npm run dev
```

By default app runs on [http://localhost:3000](http://localhost:3000).

For local DB, either:
- run MongoDB locally and keep `MONGODB_URI` as localhost, or
- use Docker Mongo and set `MONGODB_URI=mongodb://localhost:27017/askmynotes`

## 3) How to Add API Keys

1. Copy env template:
```bash
cp .env.example .env
```
2. Choose provider in `.env`:
```bash
LLM_PROVIDER=openai
# or
LLM_PROVIDER=openrouter
```
3. Add key:
```bash
OPENAI_API_KEY=your_key_here
# or
OPENROUTER_API_KEY=your_key_here
```
Optional voice transcription model override:
```bash
VOICE_INPUT_MODEL=
```
4. Set Mongo URI:
```bash
MONGODB_URI=your_mongodb_uri
```

If no API key is provided, AskMyNotes runs in **Demo Mode** and still works end-to-end.

## 4) Deployment Notes

- Production image can be built and run with Docker:
```bash
docker build -t askmynotes .
docker run -p 3000:3000 --env-file .env askmynotes npm run docker:start
```
- For cloud deploys (Render/Fly.io/Railway/AWS ECS):
  - set `MONGODB_URI`, `JWT_SECRET`, and provider key env vars
  - mount persistent storage for `UPLOAD_DIR`
  - use managed MongoDB for persistence

## Environment Variables

See `.env.example` for complete defaults.

## Tests

Run unit tests:

```bash
npm test
```

Run end-to-end smoke test (signup, 3-subject enforcement, upload, chat, Not Found, study mode):

```bash
npm run test:e2e
```

Current unit test coverage target areas:
- chunking
- retrieval filtering by `subjectId`
- Not Found gating

End-to-end smoke test validates:
- signup/login session cookie flow
- 3-subject limit enforcement
- TXT upload + parsing + chunking
- PDF upload + per-page parsing
- subject-scoped chat API with evidence/citations
- study generation API
- study grading API and marks output
- study difficulty + flashcard generation
- regenerated study variation behavior
- AI Lab generation API
- answer coach API
- boost smart search API
- boost concept explainer API
- boost planner API
- spaced repetition seed / due / rating APIs

## Voice Input Notes

- Primary mode: browser speech recognition (`SpeechRecognition` / `webkitSpeechRecognition`).
- If browser speech service fails (e.g. network error), chat auto-switches to recorder mode and uses `/api/voice/transcribe`.
- For OpenRouter voice transcription (`openai/gpt-audio-mini` default), your OpenRouter account must have sufficient audio balance.
