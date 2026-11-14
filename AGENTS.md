# General

- Never run SST cli commands unless strictly specified by user
- Do not try to build to verify the apps are working
- Do not run dev server to verify implementation
- Do not run drizzle-kit or any other db cli tool. This should be done manually
- Only git push to remote when the user asks for it.

## Architecture decisions

Decisions live in `adr/` as numbered files (`0001-roles-and-permissions.md`). Read the ones that touch your change before starting. Write a new one, with the next number, when a change makes a decision worth explaining later.

## Naming in v3/

Follows the layout in Effect's LLMS.md.

- An Effect service lives in a PascalCase file named after its class, inside a domain folder: `server/src/db/Db.ts`. Its id is that path, `"blikka/db/Db"`, so an id in a trace leads to its file
- A domain's operations are the exception: the class is `<Domain>Service` in that folder's `service.ts`. `server/src/competitions/service.ts` holds `CompetitionsService`, with the id `"blikka/competitions/CompetitionsService"`
- Every other module is camelCase: `observability.ts`, `web/src/authClient.ts`
- React components are PascalCase (`PhotoGrid.tsx`). Logic worth testing moves beside the component as `PhotoGrid.logic.ts`
- Tests sit beside their file as `*.test.ts`
- Reusable effects are `Effect.fn("Service.operation")`, which names their span
- Route files are named by their URL, as TanStack Router reads them (`routes/login.tsx`, `routes/__root.tsx`), and generated files end in `.gen.ts`

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
