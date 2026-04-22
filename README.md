<p align="center">
  <img src="blikka-github-hero.png" alt="Blikka" />
</p>

# Blikka

**Blikka** is an open-source SaaS for running photo events. Used by Stockholm Fotomaraton it handles more than 10000 photo uploads in the matter of a couple hours each year. Also powering Sthlm By Camera every week and will soon be used my one of the largest camera makers for one of their events. Handles mass submission uploads in a intuitive flow. Admins get real-time overview of their event in the dashboard and jury members get a customer rating interface to review all their submissions.

## What you can do with Blikka

- **Run participant uploads**: mobile-first flow with device selection, class selection, and live upload progress.
- **Validate submissions**: automated + manual validation (file rules, EXIF parsing, and per-marathon configuration).
- **Admin dashboard**: configure classes, topics/prompts, rules, device groups, sponsors, and review submissions.
- **Jury review**: token-based invite links for jurors to review/score.
- **Public voting**: token-based voting viewer with controlled access.
- **Exports**: generate contact sheets and downloadable ZIPs of submissions.

## How it works (high level)

- **Web app**: `apps/web` is a Next.js App Router app (React + Tailwind + Radix UI) that serves:
  - participant + staff + admin UIs (routed under `/(marathon)/...`)
  - invite/token UIs for jury and voting
  - a built-in **tRPC** API at `apps/web/src/app/api/trpc/[trpc]/route.ts`
  - auth routes at `apps/web/src/app/api/auth/[...all]/route.ts` using **better-auth**
- **API layer**: `packages/api` holds the tRPC router + services used by the web app.
- **Database**: Postgres via **Drizzle ORM** and Effect SQL (`packages/db`).
- **Media pipeline on AWS** (SST):
  - uploads land in **S3**
  - S3 events enqueue work to **SQS**
  - workers generate **thumbnails**, **contact sheets**, run **validations**, and produce **ZIP exports**
  - a bus/queues coordinate processing (see `sst.config.ts`)

## Repo layout

- `apps/web`: primary web app (Next.js)
- `packages/*`: shared libraries (auth, db, api, validation, image manipulation, s3, redis/kv-store, pubsub, email, telemetry)
- `tasks/*`: background workers (upload processing, validation, contact sheet generation, zip workers/downloaders)
- `sst.config.ts`: AWS infrastructure (S3 + queues + tasks) using SST

## Getting started (local development)

### Prerequisites

- **Node.js** \(>= 20\)
- **Bun** (repo package manager; see `package.json`)
- **AWS credentials** (SST runs against your AWS account)
- A **Postgres database** (local or managed)
- **Upstash Redis** (used for state/coordination)

### Setup

1. Install dependencies

```bash
bun install
```

2. Create an environment file

```bash
cp .env.example .env
```

3. Start SST (queues/workers/infrastructure)

```bash
bun dev:sst
```

4. Start the web app

```bash
bun dev:web
```

The web app runs on `http://localhost:3002`.

## Environment variables

Blikka expects configuration for auth, database, Redis, and external services. See `.env.example` for the canonical list (derived from `sst.config.ts`).

## Scripts

- `bun dev:sst`: run SST dev (AWS-backed local dev for infra + workers)
- `bun dev:web`: run the Next.js app locally (port 3002)
- `bun format`: format with Prettier
- `bun test`: run unit tests (Vitest)

## Contributing

Issues and pull requests are welcome.

- Keep changes focused and well-scoped
- Prefer `bun format` before opening a PR
- Add/update tests where it makes sense

## License

This project is licensed under the AGPL-3.0 for non-commercial use.
