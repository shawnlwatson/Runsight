# Runsight frontend

Next.js, React, TypeScript, Tailwind CSS, and D3 running analytics UI.

Run from this directory with Linux Node.js/npm inside WSL:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Routes and shared layout live in `src/app`, reusable charts in `src/components/charts`, and page-specific chart wrappers in `src/features`.

```bash
npm run lint
npm run build
```

Pages load runs from the FastAPI backend through `src/lib/api.ts`; start the backend first (set `NEXT_PUBLIC_API_URL` in `.env.local`). Responses follow the run contracts in `src/types`. Backend code belongs in `../backend`; data and pipeline documentation is linked from the [repository README](../../README.md).
