# 📄 DeepKlarity Resume Analyzer

![React](https://img.shields.io/badge/Frontend-TanStack%20Start-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Framework-Express.js-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql&logoColor=white)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Jest%20%2B%20Supertest-15c213?logo=jest&logoColor=white)

A full-stack, AI-powered resume analysis platform. Users upload a PDF resume and get structured
data extraction, a 1-10 rating, and actionable feedback - plus three AI features built on top of
that analysis: **JD matching with an ATS score**, a **chat interface grounded in the resume**, and
an **AI bullet-point rewriter**. Every account only ever sees its own resumes.

---

## ✨ Features

- **AI-Powered Analysis** - Google Gemini extracts structured data (contact info, skills,
  experience, projects) from a PDF resume and rates it 1-10 with concrete improvement feedback.
- **JD Match & ATS Score** - paste a job description against any stored resume and get a match
  score, matched/missing keywords, ATS-formatting red flags, and a recommendation.
- **Chat With Your Resume** - ask free-form questions about a candidate; answers stream in token by
  token over Server-Sent Events (with a Stop button), grounded only in that resume's text, and the
  conversation is persisted per resume.
- **Tailored Resume + PDF Export** - one Gemini call rewrites a resume for a pasted job description
  using only facts already in it (contact details, employers and dates are restored from the stored
  resume, never trusted from the model), shows before/after ATS and keyword scores, and exports an
  ATS-friendly single-column PDF rendered locally with `pdfkit`.
- **Rule-Based ATS Checker** - instant checks on contact info, section headings, length, action
  verbs, quantified bullets, passive phrasing and layout, plus keyword coverage against a pasted job
  description. Zero LLM calls, so it never spends Gemini quota.
- **Insights Dashboard** - resume rating and JD-match score trends, the skills you are most often
  missing, and an application funnel with response/interview/offer rates (Recharts, no extra AI calls).
- **AI Bullet-Point Rewriter** - one click on any work-experience bullet returns a stronger,
  metric-driven rewrite plus alternative phrasings.
- **Live Job Matching** - pulls current openings from Adzuna and ranks them against a resume's
  skills, with a one-click "track application" action.
- **AI Cover Letter Generator** - drafts a tailored cover letter from a pasted job description,
  grounded only in that resume's actual experience.
- **Application Tracker** - a lightweight CRM for the job search: save roles, move them through
  saved/applied/interviewing/offer/rejected, and keep notes per application.
- **Curated Learning Roadmaps** - original, hand-written roadmaps across five career tracks,
  cross-referenced against a candidate's latest resume to show which steps are already covered.
- **Accounts & Ownership** - JWT-based signup/login; every resume, chat, and rewrite is scoped to
  its owner. Nobody sees anyone else's uploads.
- **Searchable, Paginated History** - filter by file name, candidate name, or email; browse
  results a page at a time instead of loading the whole table.
- **Hardened API** - Zod input validation, per-route rate limiting, Helmet security headers,
  structured (Winston) logging, and a centralized error handler.
- **Versioned DB migrations** - schema changes ship as ordered, idempotent SQL files instead of
  manual `CREATE TABLE` steps in a README.
- **Tested** - Jest + Supertest on the API (mocked DB/Gemini); GitHub Actions CI also type-checks
  and builds the frontend on every push/PR.

---

## 🛠️ Technology Stack

| Layer      | Stack                                                                                     |
|------------|--------------------------------------------------------------------------------------------|
| Frontend   | React 19, TanStack Start + Router + Query, Tailwind CSS 4, shadcn/ui (Radix), Recharts, Vite |
| Backend    | Node.js, Express 5, JWT auth (`jsonwebtoken` + `bcryptjs`), Zod, Winston, Jest + Supertest  |
| Database   | PostgreSQL, hand-rolled versioned SQL migrations (`backend/db/migrate.js`)                  |
| AI         | Google Gemini (`@google/generative-ai`) - extraction, JD matching, chat, bullet rewriting   |
| File I/O   | `multer` (backend upload handling), `pdf-parse` (PDF text extraction)                       |
| Docs       | OpenAPI 3 spec served via Swagger UI at `/api/docs`                                         |
| Hosting    | Vercel (frontend), Render (API + Postgres), GitHub Actions CI (test, typecheck, build)     |

---

## 🏛️ Architecture

```
Browser (TanStack Start app, SSR)
   │  JWT in Authorization header
   ▼
Express API (Helmet, rate limiting, Zod validation)
   │
   ├── Auth routes  ──────────────► Postgres: users
   │
   └── Resume routes (auth-gated) ─► Postgres: resumes, chat_messages
            │
            └── Gemini services: analysis · JD match · chat · bullet rewrite
```

A resume is parsed once on upload (`pdf-parse`), analyzed once by Gemini, and the extracted text
is stored alongside the structured analysis - so JD matching and chat don't need to re-parse the
PDF on every request.

---

## 🚀 Getting Started

**Prerequisites:** Node.js 20+ (22 for the frontend), npm, a running PostgreSQL instance
(local or hosted).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in DB_*, JWT_SECRET, GOOGLE_API_KEY
npm run migrate           # creates/updates all tables
npm run dev                # http://localhost:3001, auto-reloads
```

The migration runner (`backend/db/migrate.js`) creates the database schema for you - there's no
manual SQL to paste into `psql` anymore. It's idempotent, so it's safe to re-run after pulling new
migration files.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_BASE_URL if the backend isn't on localhost:3001
npm run dev                 # http://localhost:8080
```

### Running the test suites

```bash
cd backend && npm test                         # Jest + Supertest, DB and Gemini calls are mocked
cd frontend && npm run typecheck && npm run build
```

These also run automatically on every push/PR via `.github/workflows/ci.yml`.

### API docs

With the backend running, open `http://localhost:3001/api/docs` for an interactive Swagger UI
generated from `backend/openapi.yaml`.

---

## 🔑 Environment Variables

### `backend/.env`

| Variable          | Required        | Notes                                                             |
|--------------------|:---------------:|---------------------------------------------------------------------|
| `PORT`             | no (3001)       | API port                                                            |
| `NODE_ENV`         | no              | `development` \| `production` \| `test`                             |
| `DB_USER` / `DB_HOST` / `DB_DATABASE` / `DB_PASSWORD` / `DB_PORT` | yes (unless `DATABASE_URL` set) | Local/dev Postgres connection |
| `DATABASE_URL`     | prod only       | Overrides the `DB_*` vars, e.g. on Render                            |
| `DB_SSL`           | no (`false`)    | Set `true` for managed Postgres that requires SSL                    |
| `JWT_SECRET`       | **yes**         | Long random string signing auth tokens                               |
| `JWT_EXPIRES_IN`   | no (`7d`)       | Token lifetime                                                       |
| `GOOGLE_API_KEY`   | **yes**         | Your Gemini API key                                                  |
| `GEMINI_MODEL`     | no              | Comma-separated fallback chain, tried in order (e.g. `gemini-3.6-flash,gemini-flash-latest,gemini-flash-lite-latest`); defaults to `gemini-flash-latest` alone. A withdrawn/invalid model, an exhausted daily quota, or repeated transient failures falls forward to the next one automatically.    |
| `ADZUNA_APP_ID`    | no              | App ID from https://developer.adzuna.com/ - job matching returns a friendly 503 if unset |
| `ADZUNA_APP_KEY`   | no              | App key from the same Adzuna registration                            |
| `ADZUNA_COUNTRY`   | no (`in`)       | Adzuna country code to search (e.g. `in`, `us`, `gb`)                 |
| `CORS_ORIGIN`      | no (any)        | Comma-separated frontend origins allowed to call the API, e.g. your Vercel URL |
| `LOG_LEVEL`        | no (`info`)     | Winston log level                                                    |

### `frontend/.env`

| Variable            | Notes                                              |
|---------------------|-----------------------------------------------------|
| `VITE_API_BASE_URL` | Base URL of the backend API (no trailing `/api`)    |
| `DEPLOY_TARGET`     | Build-time only, optional: Nitro preset such as `vercel` or `netlify` |

---

## 📂 Project Structure

```
backend/
  app.js                Express app (exported separately for testing)
  server.js              Boots the app: validates env, starts listening
  config/env.js          Fails fast on missing required env vars
  db/
    migrate.js            Applies pending SQL migrations
    migrations/*.sql       Versioned schema changes
  middleware/             auth, validate, rateLimiter, errorHandler
  validators/              Zod request schemas
  services/                analysisService, jdMatchService, chatService, rewriteService
  controllers/, routes/    authController/Routes, resumeController/Routes
  tests/                   Jest + Supertest

frontend/
  src/
    routes/                File-based routes (TanStack Router): login, history, resumes/$id/*, jobs, ...
    components/            resume-app.tsx (feature pages) and ui/ (shadcn primitives)
    lib/                   resume-api.ts (typed API client), auth, useApiAction, content-profile
    server.ts, start.ts    SSR entry + error/CSRF middleware
```

---

## ☁️ Deployment

Frontend on **Vercel**, API + Postgres on **Render**. Deploy the backend first, because the
frontend needs its URL at build time.

### 1. Backend (Render)

The `render.yaml` Blueprint at the repo root provisions a free Postgres database and a Node web
service (root dir `backend`, `npm install` then `npm run migrate && npm start`), wiring
`DATABASE_URL` between them automatically. `JWT_SECRET` is generated for you.

1. Push this repo to GitHub.
2. In Render: **New +** → **Blueprint** → select this repo.
3. When prompted, fill in the secret values: `GOOGLE_API_KEY` (required), and optionally
   `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` (job search). Leave `CORS_ORIGIN` empty for now.
4. Once it's live, copy the service URL (e.g. `https://resume-analyzer-backend.onrender.com`)
   and check `<url>/api/health` returns `{"status":"ok"}`.

Free Render services sleep after ~15 minutes idle, so the first request after a pause can take
30-60 seconds. Render's free Postgres also expires after 30 days unless you upgrade it.

### 2. Frontend (Vercel)

1. **Add New → Project** → import this repo.
2. Set **Root Directory** to `frontend`. Leave framework preset, build command and output
   directory on their defaults (the build writes Vercel's output format itself).
3. Add environment variables:
   - `VITE_API_BASE_URL` = your Render URL from above (no trailing `/api`)
   - `DEPLOY_TARGET` = `vercel`
4. Deploy.

`VITE_API_BASE_URL` is baked in at build time, so redeploy the frontend if the backend URL changes.

### 3. Lock CORS to your frontend

Back in Render → the web service → **Environment**, set `CORS_ORIGIN` to your Vercel URL (e.g.
`https://your-app.vercel.app`, comma-separate several) and save. The service redeploys itself.

---

## 🗺️ Possible Next Steps

- Vector-embedding-based semantic search across a user's whole resume history
- Multi-format uploads (DOCX via `mammoth`)
- A second LLM provider as an automatic fallback if Gemini errors/rate-limits
