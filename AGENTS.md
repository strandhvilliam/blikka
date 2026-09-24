# General

- Never run SST cli commands unless strictly specified by user
- Do not try to build to verify the apps are working
- Do not run dev server to verify implementation
- Do not run drizzle-kit or any other db cli tool. This should be done manually
- Do not git push to remote ever. This should always be done manually.

## Vendored Repositories

This project vendors external repositories under @.repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @.repos/ unless explicitly asked
- Do not import from @.repos/ - application code should continue importing from normal package dependencies
- @.repos/ is gitignored and provisioned by `scripts/prepare-effect.sh`, which `bun install` runs. If a checkout is missing, run `bun install` rather than cloning by hand

### Effect

When writing Effect code, inspect @.repos/effect/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

Always read @.repos/effect/LLMS.md before writing any Effect code.

- If an `effect-ts` skill is available, invoke it before non-trivial Effect work. It is not part of this repo, so do not assume it exists
- Effect is on a v4 beta. APIs get renamed and removed between releases, so look unfamiliar ones up in the vendored source instead of recalling them
- All `effect` and `@effect/*` versions come from `workspaces.catalog` in the root package.json. Never pin an Effect version inside a workspace package. Move every `@effect/*` package together and keep `overrides.effect` in sync
- The vendored checkout tracks `main` and is usually ahead of the pinned version. When the two disagree, the installed version is what runs

#### Upgrading Effect

- Typecheck before running tests. `bunx tsc --noEmit -p <dir>` over the workspace packages is the fastest way to find a bump's breakage, and unlike tests it covers untested code paths. Renamed and removed APIs surface as TS2339/TS2551
- Then run `bun run test` to confirm behaviour
- Capture both on the current version first. This workspace has pre-existing type errors and failing tests, so the bar is "no new failures", not "zero failures"
- Read `.repos/effect/packages/effect/CHANGELOG.md` between the two versions for the breaking-change entries
- Verify semantics, not just names, when an API is replaced. `Schedule.both(a, b)` became `Schedule.max([a, b])`, whose name suggests it only picks the slowest delay. It also stops as soon as any schedule finishes, which is what keeps a `Schedule.recurs(n)` bounding a retry - had it not, every retry loop using it would have become unbounded in production. Confirm behaviour like this in the vendored source before swapping

## Cursor Cloud specific instructions

Durable notes for agents working in the Cursor Cloud VM. Standard commands live in `README.md` / root `package.json` scripts; this section only covers non-obvious gotchas.

### Toolchain / package manager

- **Bun >= 1.2 is required**, even though root `package.json` pins `packageManager: bun@1.1.35`. That pin is stale: the repo uses the text `bun.lock` and `workspaces.catalog`, which are Bun 1.2+ features. Bun 1.1.x fails install with a misleading `"git clone" for "@effect/vitest" failed` / `catalog: failed to resolve` error. The setup snapshot has Bun (1.3.x) installed at `~/.bun` and symlinked to `/usr/local/bin/bun`, so `bun`/`bunx` are on `PATH` by default.
- `bun install` runs the `prepare` script (`scripts/prepare-effect.sh`), which shallow-clones Effect into `.repos/effect` (gitignored). It needs network access to GitHub and is idempotent.

### Running the app

- The only runnable app is `apps/web` (Next.js 16 + Turbopack). `bun run dev:web` serves it on **http://localhost:3002**. The **public marketing/landing pages render with no external services** — good for verifying the build/serve toolchain.
- **DB/auth/dashboard/upload flows require real managed services** and will throw at render without them: Neon Postgres (`DATABASE_URL`), Upstash Redis (`UPSTASH_REDIS_REST_URL`/`TOKEN`), AWS S3+SQS, Resend, Google OAuth. Example: `/auth/login` renders a Next.js dev error overlay with `DbError: DATABASE_URL is required` when no DB is configured.
- The DB client uses the **Neon serverless HTTP driver** (`@neondatabase/serverless`), which POSTs SQL to `https://<host>/sql`. A raw local Postgres over the wire protocol will NOT work — you'd need a Neon HTTP proxy. There is no baseline schema SQL in the repo (only incremental patches under `packages/db/migrations/manual/`); the schema is defined in Drizzle and provisioned via `drizzle-kit push`, which the General rules say not to run.
- **Env-loading gotcha:** `bun run dev:web` runs `next dev` with cwd `apps/web`, so Next loads env from `apps/web/.env(.local)`, **not** the repo-root `.env`. The intended full-stack dev loop is `bun run dev:sst` (SST injects linked AWS resource env into the process) alongside `bun run dev:web`. Per the General rules, do not run `sst` unless the user asks.

### Lint / test

- Lint: `bun run lint:web`. Tests: `bun run test` (Vitest). Both run cleanly but the repo has **pre-existing** lint errors and one failing test (`@blikka/uploads` `submission-processor.test.ts`), so the bar is "no new failures", not "zero failures".
