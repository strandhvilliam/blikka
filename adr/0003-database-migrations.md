# ADR-0003: Every schema change is a generated, committed, append-only Drizzle migration

- **Status**: Proposed
- **Area**: API (`apps/blikka`)
- **Date**: 2026-11-09

## Context

The old app (`packages/db`) changed the database with hand-written SQL files in
`migrations/manual/`, applied by hand. Nothing recorded which files had run against which
database, so the files had to be written as `if not exists` / `drop constraint if exists` to be
safe to re-run. The Drizzle model and the real schema drifted apart, and the only way to know the
production schema was to look at production.

v3 has no migrations yet (`apps/blikka/drizzle/` does not exist), so we can set the rules before
the first one.

## Decision

### One way to change the schema

1. Edit `src/api/model.ts`.
2. `bun run db:generate <what_changed>` from `apps/blikka`. Name every migration
   (`add_jury_invitations`, not the random default).
3. Read the generated SQL (see below).
4. Commit `model.ts` and everything under `drizzle/` (SQL, `meta/_journal.json`, snapshot) in
   the same commit.
5. Deploy with `bun run deploy` or `bun run deploy:prod`. Both run `drizzle-kit check`, then
   `drizzle-kit migrate` against that stage's `DATABASE_URL` (the direct Postgres URL, never
   Hyperdrive), then `alchemy deploy`. A failed check or migration stops the deploy. Run
   `migrate` on its own only to set up a fresh local database.

No `drizzle-kit push`, no SQL typed into a console, no files applied by hand. The
`drizzle.__drizzle_migrations` table in each database is the record of what has run there, and it
is only correct if every change goes through `migrate`.

Changes Drizzle cannot express from the model (backfills, data fixes, extensions, triggers) use
`bun run db:generate <what_changed> --custom`, which creates an empty SQL file in
the same sequence. It is written by hand and committed like any other migration.

### Read the SQL before committing

`generate` diffs snapshots; it does not know your intent. Check for:

- **Renames.** When a column or table disappears and another appears, `generate` asks whether it
  was renamed. Answering "create" emits a drop and an add, which deletes the data.
- **`NOT NULL` on an existing table** without a default fails if any row exists. Add the column
  nullable, backfill, then set `NOT NULL` in a later migration.
- **Type changes** that need a `USING` clause, and **drops** of any kind.

### Applied migrations are frozen

A migration that has run against any shared database is never edited, deleted, or reordered.
Mistakes are fixed with a new migration. There are no down migrations; rolling back means writing
the reverse as a new migration, or restoring a backup.

A migration that exists only on your branch and has not been applied anywhere shared can be thrown
away and regenerated.

### Branches

The journal and the snapshot chain are linear, so two branches that each generate a migration
conflict. The branch that merges second resolves it by discarding its own migration rather than
merging the files:

1. `git checkout main -- apps/blikka/drizzle` (after rebasing onto `main`).
2. Regenerate with `generate --name ...`.
3. `bunx drizzle-kit check` to confirm the history is consistent.

Never hand-merge `_journal.json` or snapshot files.

### Migrate first, then deploy, so every migration must work with the code already running

The deploy scripts run `drizzle-kit migrate` before `alchemy deploy` (the order Polar gets from
running migrations in Render's pre-deploy step), so for a while the old Worker runs against the
new schema. A migration may only make changes the running code tolerates: add tables, add
nullable columns or columns with defaults, add indexes.

A breaking change (rename, drop, type change, new `NOT NULL`) is split over releases
(expand, then contract):

1. Migration adds the new shape. Deploy code that writes both and reads the new one.
2. Custom migration backfills.
3. A later migration removes the old shape, once no deployed code uses it.

### Running against production

- All pending migrations run in one transaction on Postgres (`PgDialect.migrate` in
  `drizzle-orm`), so a failure applies none of them. A consequence is that statements Postgres
  refuses inside a transaction, such as `CREATE INDEX CONCURRENTLY`, cannot go in a migration.
- A migration that alters an existing table starts with `SET LOCAL lock_timeout = '5s';`, so a
  lock it cannot get fails the deploy instead of queueing every query behind it. Add the line to
  the generated file before committing it. Because the migrations share one transaction, it also
  covers every migration after it in the same run.
- Before deploying, compare `drizzle/meta/_journal.json` with
  `select * from drizzle.__drizzle_migrations` to know exactly what will run, and confirm a recent
  backup or point-in-time restore exists.
- Apply to a non-production stage first.

## Consequences

- Any database's schema is the list of migrations recorded in it, and `model.ts` matches `main`.
- A fresh database (new stage, local dev) is created with `migrate` alone.
- Breaking changes cost two or three releases instead of one.
- Parallel branches that touch the schema need the regenerate step above.

## Alternatives considered

- **`drizzle-kit push`.** No files, no history, and it can prompt for or apply destructive
  changes directly. Fine for a throwaway database, not for anything shared.
- **Running `migrate()` from the Worker at startup.** Workers start per isolate and have no
  single deploy hook, so concurrent isolates would race the migration. Revisit if a deploy step in
  `alchemy.run.ts` can run it once.
- **Hand-written SQL files (the old app).** The reason for this ADR.

## Open questions

- Deploys run from a laptop for now. When they move to CI, the same `deploy` scripts become the
  job that runs on merge to `main`: a non-production stage first, then production. PRs then also
  get a drift check: `drizzle-kit generate` must leave `drizzle/` unchanged, which catches a
  `model.ts` change committed without its migration (Polar runs `alembic check` for the same).

- Drizzle Kit v1 replaces the journal with a folder per migration and makes `check` detect
  branches that diverged, which removes most of the branch conflicts above. Adopt it when it
  leaves beta, with `drizzle-kit up` to convert the folder.
