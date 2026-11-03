# DeepKlarity Frontend

The TanStack Start (React 19, Tailwind 4, shadcn/ui) frontend for DeepKlarity: resume analysis,
JD matching, chat, bullet rewrites, job search, an application tracker and learning roadmaps.
It talks to the Express/PostgreSQL API in `../backend`.

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL if the backend isn't on localhost:3001
npm run dev
```

Opens on http://localhost:8080. The backend must be running separately (see the repo root
`README.md`).

## Scripts

- `npm run dev` - local dev server
- `npm run build` - production build (SSR server in `.output/`)
- `npm run typecheck` - TypeScript check
- `npm run lint` / `npm run format` - eslint / prettier

## Deploying

Deployed on Vercel with root directory `frontend`. Set `VITE_API_BASE_URL` (the Render backend
URL) and `DEPLOY_TARGET=vercel` in the Vercel project's environment variables. See the repo root
`README.md` for the full deployment steps.
