# Blikka v3

An Effect + [Alchemy](https://alchemy.run) stack on Cloudflare, built here next to the old app until it replaces it (then `v3/*` moves to the repo root). See [ADR-0005](../adr/0005-v3-layout.md).

```
alchemy.run.ts   the stack: the Api Worker from server/, the website from web/
server/          @blikka/server: Effect, the Api (src/api.ts), auth, database, migrations (drizzle/)
web/             @blikka/web: TanStack Start site, built by Cloudflare.Website.Vite; talks to the Api over HTTP only
domain.ts, sentry-project.ts, drizzle.config.ts, docker-compose.yml, scripts/   shared by the stack and dev tooling
```

The browser calls the Api on its own origin, and nothing in the Api depends on the website, so the frontend can be swapped out. Each package sees only the dependencies it declares (Bun's isolated installs), so `web` can't import `pg`, `drizzle-orm` or `@blikka/server`. Background jobs and containers become more entrypoints in `server/`, next to `src/api.ts`.

Deploying needs a Cloudflare login; `alchemy dev` doesn't (its state stays in `.alchemy/`). Log in once with `bunx alchemy profile edit --add Cloudflare`; credentials go to the `default` profile in `~/.alchemy`. CI uses `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` instead.

```bash
bun run up       # check and set up everything local (deps, .env, Postgres, migrations), then dev
bun run dev      # local workerd, stage dev_$USER, logs in the terminal (no Axiom), state in .alchemy/; no Cloudflare account needed
bun run deploy   # migrate the .env database, then deploy to Cloudflare, stage live_$USER
bun run deploy:prod  # migrate the .env.prod database, then deploy the prod stage, the only one served on the custom domain
bun run destroy  # tear down
```

`dev` unsets `npm_execpath` so the alchemy CLI runs under Node: under Bun, beta.84 starts the Vite child with the unpublished `register-dev-mode.js` (fixed upstream in alchemy-run/alchemy#2525). Drop the `env -u npm_execpath` once a release after `2.0.0-beta.84` includes that fix.

`overrides.rolldown` keeps one copy of rolldown installed. Vite wants `~1.2.14` and the alchemy packages pin `1.2.13`, so without it each alchemy package gets its own copy. Alchemy's plugin that turns CJS `require("events")` (from `pg`) into an import then fails its `instanceof` check, and the Api worker crashes on startup. Drop the override once alchemy and vite agree on a version.

`v3/` is outside the root workspace's globs, so it can run Effect 4.0 stable and the latest `alchemy` while the old app stays on the catalog's `4.0.0-beta.101` (the root `overrides.effect` would otherwise force it). It is its own workspace with its own `bun.lock`; run `bun install` and every script here, inside `v3/`.

## Domains

`prod` is served on the domain in `domain.ts`: the website at `<domain>` and the Api at `api.<domain>`. Its DNS must be on Cloudflare, and Alchemy manages the records and certificates. Other stages run on `workers.dev`, and `alchemy dev` on localhost (website on 5173, Api on 1337). The website gets the Api's URL as `API_URL` from the stack.

On the domain, the Api sets its session cookie for `<domain>` and every subdomain, so the website's server receives it too and renders signed-in pages: the root route asks the Api's `/me` with that cookie (`sessionQuery` in `web/src/session.ts`, through the client in `web/src/api.ts`) and passes it to every route as `context.session`. In dev both run on localhost, which shares cookies across ports. On `workers.dev` the two are different sites, so sign-in doesn't work on deployed stages until they have a domain.

## Api contract

The Api's endpoints are defined in `server/src/contract.ts` (Effect `HttpApi`, Schemas only), which adds each domain folder's group. A domain folder (`server/src/organizations/`) holds its schemas and errors (`schemas.ts`), its endpoints (`endpoints.ts`), its operations (`service.ts`, also for jobs) and thin handlers (`handlers.ts`); `server/src/api.ts` serves them. The Api serves the spec at `/openapi.json`. After changing the contract, run `bun run api:generate`: it writes the spec to `server/openapi.json` and the website's types to `web/src/api.gen.ts`. The website calls the Api with `openapi-fetch` and those types (`web/src/api.ts`), never through server functions, and runs no Effect code. See `adr/0002-website-and-api-boundary.md`.

## Auth

Better Auth runs in the `Api` worker (`server/src/auth/Auth.ts`) under `/auth/*`. The browser calls it directly with credentials; the Api allows CORS from `WEBSITE_URL` only.

Browsers authenticate with the session cookie. Every other client (SDKs, apps, scripts) signs in through the same endpoints, takes the token from the `set-auth-token` response header, and sends it as `Authorization: Bearer <token>`. It is the same session either way, so the `Authenticated` middleware (`server/src/auth/Authenticated.ts`) works for both and signing out revokes both. Sign-in methods are Google and email OTP. Postgres is reached through Hyperdrive (`server/src/db/Db.ts`).

A code allows 3 guesses, and an email gets at most 5 codes an hour (`otp_sends`, counted in `Auth.ts`), which is what stops someone guessing their way into another account. Better Auth's own rate limiter is off: it only turns on when `NODE_ENV` is `production`, which the Worker doesn't set, and it counts per IP. The emailOTP endpoints the website doesn't call are disabled (`disabledAuthPaths`).

Add these to `.env` for `alchemy dev`. `bun run deploy:prod` reads `.env.prod` instead (not on top of `.env`, so it needs every variable), with the URLs set to `https://api.<domain>` and `https://<domain>`:

```bash
DATABASE_URL=postgres://user:pass@host:5432/db  # Hyperdrive origin; also read by drizzle-kit
BETTER_AUTH_SECRET=...                           # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:1337            # the Api's origin
WEBSITE_URL=http://localhost:5173                # the website's origin, allowed by CORS
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...                         # redirect URI: $BETTER_AUTH_URL/auth/callback/google
```

The Google pair is required on deployed stages. Under `alchemy dev` it is optional: leave it out and sign in with email OTP, whose code is logged in the terminal.

## Errors (Sentry)

Errors from the `Api` worker, the website server and the browser go to the Sentry project in `sentry-project.ts`, tagged with the stage as `environment`. Reporting is off under `alchemy dev` and whenever `SENTRY_DSN` is unset. Source maps are uploaded on deploy when `SENTRY_AUTH_TOKEN` is set.

```bash
SENTRY_DSN=https://...@....ingest.sentry.io/...  # project DSN
SENTRY_AUTH_TOKEN=sntrys_...                      # org token with project:releases, for source maps
```

- `Api`: `withSentry` (`server/src/sentry/SentryScope.ts`) wraps the HTTP handler. Failures that are respondable (e.g. `Unauthorized` → 401) are expected and not reported; any other failure or defect is logged, reported with the request and its Axiom `trace_id`, and answered with a 500. Report a handled error yourself with `yield* captureException(error)`; don't call `Sentry.*` directly inside Effect code, since the scope it reads may belong to another request.
- Website server: `web/src/server.ts` wraps TanStack Start's handler with `Sentry.withSentry`, but Start rarely lets an error escape it. Failed server functions are reported by the middleware in `web/src/start.ts`, and failures of the root route while rendering on the server by its `onError`. Any other route's failure reaches the browser with the page and is reported there. `@sentry/tanstackstart-react` isn't used: it pulls in `@sentry/node`, which doesn't run on Workers, so its middleware is copied.
- Browser: `web/src/client.tsx` initialises `@sentry/react` from the meta tags the root route renders, and reports React render and route errors.

## Local database

`alchemy dev` connects to the Postgres in `docker-compose.yml` (the `dev` origin in `server/src/db/Db.ts`), never to `DATABASE_URL`, which stays the database for `bun run deploy`. `DATABASE_URL` must still be set, since the deployed origin is read either way. `bun run up` starts it and applies new migrations; by hand that is:

```bash
docker compose up -d
DATABASE_URL=postgres://postgres:postgres@localhost:5433/blikka bunx drizzle-kit migrate
```

`docker compose down -v` wipes it.

Create the tables on other databases with `bunx drizzle-kit migrate` (run manually). Schema changes follow [ADR-0003](../adr/0003-database-migrations.md). Until real email sending is wired up, OTP codes are logged by the worker.
