# blikka

Effect + [Alchemy](https://alchemy.run) stack on Cloudflare. `alchemy.run.ts` defines the stack: the `Api` Worker (`src/api`) and a TanStack Start site (`src/web`, built by `Cloudflare.Website.Vite` via `vite.config.ts`). The two are separate: the browser calls the Api on its own origin, and nothing in the Api depends on the website, so the frontend can be swapped out.

Log in once with `bunx alchemy profile edit --add Cloudflare`; credentials go to the `default` profile in `~/.alchemy`. CI uses `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` instead.

```bash
bun run dev      # local workerd, stage dev_$USER; state is still stored in your Cloudflare account
bun run deploy   # deploy to Cloudflare, stage live_$USER
bun run deploy:prod  # deploy the prod stage, the only one served on the custom domain
bun run destroy  # tear down
```

`dev` unsets `npm_execpath` so the alchemy CLI runs under Node: under Bun, beta.84 starts the Vite child with the unpublished `register-dev-mode.js` (fixed upstream in alchemy-run/alchemy#2525). Drop the `env -u npm_execpath` once a release after `2.0.0-beta.84` includes that fix.

This app is excluded from the root workspace (`!apps/blikka` in the root `package.json`) so it can run Effect 4.0 stable and the latest `alchemy` while the rest of the repo stays on the catalog's `4.0.0-beta.101` (the root `overrides.effect` would otherwise force it). It has its own `bun.lock`; run `bun install` inside `apps/blikka`.

## Domains

`prod` is served on the domain in `src/domain.ts`: the website at `<domain>` and the Api at `api.<domain>`. Its DNS must be on Cloudflare, and Alchemy manages the records and certificates. Other stages run on `workers.dev`, and `alchemy dev` on localhost (website on 5173, Api on 1337). The website gets the Api's URL as `API_URL` from the stack.

On the domain, the Api sets its session cookie for `<domain>` and every subdomain, so the website's server receives it too and renders signed-in pages: the root route asks the Api for the session with that cookie (`src/web/session.ts`) and passes it to every route as `context.session`. In dev both run on localhost, which shares cookies across ports. On `workers.dev` the two are different sites, so sign-in doesn't work on deployed stages until they have a domain.

## Auth

Better Auth runs in the `Api` worker (`src/api/auth.ts`) under `/auth/*`. The browser calls it directly with credentials; the Api allows CORS from `WEBSITE_URL` only. Sign-in methods are Google and email OTP. Postgres is reached through Hyperdrive (`src/api/db.ts`).

Add these to `.env` (values for `alchemy dev`; for `prod`, `https://api.<domain>` and `https://<domain>`):

```bash
DATABASE_URL=postgres://user:pass@host:5432/db  # Hyperdrive origin; also read by drizzle-kit
BETTER_AUTH_SECRET=...                           # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:1337            # the Api's origin
WEBSITE_URL=http://localhost:5173                # the website's origin, allowed by CORS
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...                         # redirect URI: $BETTER_AUTH_URL/auth/callback/google
```

## Errors (Sentry)

Errors from the `Api` worker, the website server and the browser go to the Sentry project in `src/sentry-project.ts`, tagged with the stage as `environment`. Reporting is off under `alchemy dev` and whenever `SENTRY_DSN` is unset. Source maps are uploaded on deploy when `SENTRY_AUTH_TOKEN` is set.

```bash
SENTRY_DSN=https://...@....ingest.sentry.io/...  # project DSN
SENTRY_AUTH_TOKEN=sntrys_...                      # org token with project:releases, for source maps
```

- `Api`: `withSentry` (`src/api/sentry.ts`) wraps the HTTP handler. Failures that are respondable (e.g. `Unauthorized` → 401) are expected and not reported; any other failure or defect is logged, reported with the request and its Axiom `trace_id`, and answered with a 500. Report a handled error yourself with `yield* captureException(error)`; don't call `Sentry.*` directly inside Effect code, since the scope it reads may belong to another request.
- Website server: `src/web/server.ts` wraps TanStack Start's handler with `Sentry.withSentry`.
- Browser: `src/web/client.tsx` initialises `@sentry/react` from the meta tags the root route renders, and reports React render and route errors.

Create the tables with `bunx drizzle-kit generate` followed by `bunx drizzle-kit migrate` (both run manually). Until real email sending is wired up, OTP codes are logged by the worker.
