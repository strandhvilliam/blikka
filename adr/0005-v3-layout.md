# ADR-0005: v3 lives in `v3/` as two packages, `server` and `web`, deployed by one stack

- **Status**: Proposed
- **Area**: Repository layout (`v3`)
- **Date**: 2026-11-10

## Context

v3 started as `apps/blikka`: one package holding both the Api (`src/api`) and the website
(`src/web`). ADR-0002 already splits them at runtime (two Workers, a typed HTTP contract), but in
code they shared one `package.json`, one `tsconfig` and one dependency list, so React and `pg`
were available to both, and "the website imports nothing from the Api" was a rule only.

v3 is also about to grow past HTTP: long-running async work (exports, contact sheets, image
processing) needs queue consumers, Workflows or containers, and they share the database, models
and services with the Api.

It sits in `apps/` but is excluded from the root workspace (`!apps/blikka`), because the root
`package.json` belongs to the old app and pins Effect to `4.0.0-beta.101` through its catalog and
`overrides.effect`.

## Decision

### Layout

```
v3/
  package.json       its own workspace and bun.lock; shared versions in its catalog
  alchemy.run.ts     one stack: the Api from server/, the Website from web/
  server/            @blikka/server
  web/               @blikka/web
```

- `v3/` is at the repo root, outside the root workspace's globs (`apps/*`, `packages/*`,
  `tasks/*`), so nothing about the old app's install, tests or deploys changes. When the old app is
  removed, `v3/*` moves to the repo root.
- **`server` is the whole backend, Polar style**: one package with several entrypoints.
  `src/api.ts` is the Api Worker; background jobs (`src/jobs.ts`) and containers
  (`containers/<name>/`) are added next to it and reuse the same modules. The domain is organised
  by folder, not by package.
- **`web` is the website.** It declares no dependency on `server`, and calls it only through
  the generated OpenAPI types (ADR-0002). Its runtime env type is declared in `web/src/env.ts`;
  `alchemy.run.ts` checks that the Website provides every key, so the website never imports the
  stack file (which imports the server).
- Stack-level config shared by both (`domain.ts`, `sentry-project.ts`) and dev tooling
  (`drizzle.config.ts`, `docker-compose.yml`, `scripts/up.ts`) stay at the `v3/` root, where every
  script runs and where `.env` is.

### No more packages until there is a second consumer

`db`, `auth` and the other backend modules are folders in `server/src`, not packages: each has
one consumer, and every package costs a manifest, a tsconfig, an exports map and Effect version
syncing. A package is split out only for a second consumer (`@blikka/client`, the generated
OpenAPI client, once `upload-sdk` or a mobile app needs it), a different runtime or native
dependencies (a container), or publishing.

## Consequences

- Bun installs each package in isolation, so `web` can't resolve `pg`, `drizzle-orm` or
  `@blikka/server`, and `server` can't resolve React. This is not a full guard: relative imports
  across folders and the root package's own dependencies (`effect`, `alchemy`) still resolve
  from `web`.
- `server` has no DOM types; `web` adds DOM and `vite/client` in its own `tsconfig.json`.
- One `bun run deploy` still deploys both, since the Website needs the Api's URL.
- The Docker Compose project is pinned to `blikka`, so the local Postgres keeps its volume after
  the move.

## Alternatives considered

- **Top-level `server/` and `web/` now.** Both need a workspace root, and the only one at the
  top is the old app's, which would force its Effect version on v3. Deferred until the old app is
  gone.
- **Two separate installs (Polar's `server/` + `clients/`).** Polar's split follows a language
  boundary and two deploys. Ours is one TypeScript stack deployed together; two lockfiles would
  add friction for nothing.
- **A package per module (`db`, `auth`, ...), as the old app's `packages/` did.** See above.
- **A separate contract package.** Only the server and its codegen script
  read the Effect contract, so it stays in `server/src/contract.ts`.
