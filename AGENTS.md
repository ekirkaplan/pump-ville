# Repository Guidelines

## Project Structure & Module Organization
- `src/app/`: Next.js App Router entrypoints (layouts, pages, and API routes under `src/app/api/`).
- `src/components/`: Shared React components (PascalCase filenames).
- `src/hooks/`: Reusable React hooks (camelCase names like `useSomething`).
- `src/lib/`: Utility modules and shared logic.
- `public/`: Static assets served as-is (images, JSON, etc.).
- `cron-setup.js`: Node script for scheduling/cron setup.
- Config: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`.

## Build, Test, and Development Commands
- `npm run dev`: Start the local dev server with Turbopack.
- `npm run build`: Create a production build.
- `npm run start`: Run the production server from the build output.
- `npm run lint`: Run ESLint with Next.js rules.
- `npm run cron`: Execute the cron setup script.

## Coding Style & Naming Conventions
- TypeScript + React with 2-space indentation, semicolons, and single quotes as shown in existing files.
- Prefer path aliases for imports: `@/` maps to `src/` (see `tsconfig.json`).
- Keep component files in `src/components/` and hooks in `src/hooks/`.
- Tailwind CSS classes live inline in `className` strings; keep them readable and grouped.

## Testing Guidelines
- No automated test runner is configured in `package.json` yet.
- If you add tests, wire a script (e.g., `npm test`) and keep tests close to code (`*.test.ts` / `*.test.tsx`) or under `src/__tests__/`.
- Use `npm run lint` as the minimum quality gate.

## Commit & Pull Request Guidelines
- This checkout has no `.git` history, so no existing commit convention is detectable.
- Use short, imperative commit subjects (e.g., “Add wallet sync”) and keep commits focused.
- PRs should include: a brief summary, testing notes/commands run, and screenshots for UI changes.

## Security & Configuration Tips
- Copy `.env.local.example` to `.env.local` and keep secrets out of Git; `.env*` is ignored.
- Document any new environment variables in `.env.local.example`.
