# blikka

Effect + [Alchemy](https://alchemy.run) stack on Cloudflare. `alchemy.run.ts` defines the stack: the `Api` Worker (`src/api`) and a TanStack Start site (`src/web`, built by `Cloudflare.Website.Vite` via `vite.config.ts`) bound to it as `env.API`.

Log in once with `bunx alchemy profile edit --add Cloudflare`; credentials go to the `default` profile in `~/.alchemy`. CI uses `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` instead.

```bash
bun run dev      # local workerd, stage dev_$USER; state is still stored in your Cloudflare account
bun run deploy   # deploy to Cloudflare
bun run destroy  # tear down
```

`dev` unsets `npm_execpath` so the alchemy CLI runs under Node: under Bun, beta.84 starts the Vite child with the unpublished `register-dev-mode.js` (fixed upstream in alchemy-run/alchemy#2525). Drop the `env -u npm_execpath` once a release after `2.0.0-beta.84` includes that fix.

This app is excluded from the root workspace (`!apps/blikka` in the root `package.json`) so it can run Effect 4.0 stable and the latest `alchemy` while the rest of the repo stays on the catalog's `4.0.0-beta.101` (the root `overrides.effect` would otherwise force it). It has its own `bun.lock`; run `bun install` inside `apps/blikka`.

## Auth

Better Auth runs in the `Api` worker (`src/api/auth.ts`), and the website proxies `/api/*` to it (`src/web/routes/api/$.ts`) so cookies are first-party. Sign-in methods are Google and email OTP. Postgres is reached through Hyperdrive (`src/api/db.ts`).

Add these to `.env`:

```bash
DATABASE_URL=postgres://user:pass@host:5432/db  # Hyperdrive origin; also read by drizzle-kit
BETTER_AUTH_SECRET=...                           # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:5173            # the website origin, not the worker's
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...                         # redirect URI: $BETTER_AUTH_URL/api/auth/callback/google
```

Create the tables with `bunx drizzle-kit generate` followed by `bunx drizzle-kit migrate` (both run manually). Until real email sending is wired up, OTP codes are logged by the worker.
