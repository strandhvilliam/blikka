# ADR-0002: The website renders pages, the API owns data, and a typed contract is all they share

- **Status**: Proposed
- **Area**: Website and API (`apps/blikka`)
- **Date**: 2026-11-09

## Context

v3 runs two Workers: the Api (`src/api/worker.ts`, Effect) and the website (`src/web`, TanStack
Start). We keep Start for server-side rendering. A participant scanning a QR code on a phone over
mobile data should see the upload page in the first response, not after the HTML, the JS and an
API call have each made a round trip. Of the comparable apps we looked at, Hi.Events
(separate Laravel API, React SSR server it wrote itself) and Polar (FastAPI, Next.js) do the
same, and Immich (NestJS, SvelteKit as a pure SPA) only injects Open Graph tags for shared links.

Start can also be a backend: server functions (`createServerFn`) are an RPC layer only the
website can call. If data goes through them, the website ends up with a private API next to the
real one, and a future client (a mobile app, a partner integration, a script) gets a second-class
API. The old app's tRPC routers had the same problem: only TypeScript clients could use them
comfortably.

Two things already go against this and are cheap to fix now, while there are only two routes:

- `getSession` (`src/web/session.ts`) is a server function. After the first load, every
  navigation goes browser → website Worker → Api, and the root `beforeLoad` runs it on every
  navigation.
- Api routes are added with `HttpRouter.add`, so nothing describes them for a client to use.

## Decision

### The API contract is the only thing the two share

- Endpoints are defined with Effect `HttpApi` in a contract module that holds only Schemas:
  `src/api/contract.ts`, split per resource when it grows.
- The Api implements the contract and serves its OpenAPI spec at `/openapi.json`.
- `bun run api:generate` writes the spec to `openapi.json` (`OpenApi.fromApi`) and generates the
  website's types from it into `src/web/api.gen.ts` (`openapi-typescript`). The website calls the
  Api with `openapi-fetch` and those types, the same way any other client would.
- No Effect code runs in the website. It renders pages and fetches data, and keeps no server logic
  of its own, so the browser bundle stays small.
- Expected failures are errors in the contract (`NotFound`, `Unauthorized`, `Forbidden`), each
  with its own status code, so every client sees the same failures.
- `src/web` imports nothing from `src/api`. It only sees the generated types, so the database,
  Better Auth and secrets can't reach the website bundle.

### Data never goes through server functions

- Route loaders call the Api client directly. A loader runs on the server for the first load
  and in the browser after that, and both talk to the Api.
- Only credentials differ. On the server, the client forwards the incoming `cookie` header. In
  the browser, it sends `credentials: "include"`. This lives in one `createIsomorphicFn`, not in
  each loader.
- The client takes its `fetch` as a parameter, so the server side can later call the Api through
  a Cloudflare service binding instead of the public URL.
- Server functions are allowed only for what the website itself owns, such as `getPublicConfig`
  in `src/web/routes/__root.tsx`, which reads the website's env.

### TanStack Query is the cache, and loaders fill it

- Each resource has one `queryOptions` factory, holding its query key and its Api call.
- Loaders call `queryClient.ensureQueryData(options)`. Components read the same options with
  `useSuspenseQuery`.
- `@tanstack/react-router-ssr-query` sends the server's cache to the browser, so hydration does
  not fetch again.
- Mutations call the Api client, then invalidate the keys they change.
- The session is a query with a `staleTime`, not an Api call on every navigation.

### Layout routes mirror access

```
routes/
  _public/        participant, gallery and voting pages; no sign-in, rendered on the server with data
  _authed/        beforeLoad redirects to /login when signed out
    $org/         loads the organization once for every page below it
  login.tsx
```

- Whether a subtree renders on the server is set on its layout route, not page by page. All
  routes keep Start's default (server rendering on) until a reason appears.
- Authorization follows ADR-0001. The Api enforces it. The website reads the caller's permission
  list only to hide actions.

### One helper turns Api errors into routing

Loaders don't handle Api errors themselves. One helper maps them: `NotFound` → `notFound()`,
`Unauthorized` → `redirect({ to: "/login" })`, `Forbidden` → the route's error component.
Anything else is thrown to the error boundary, which already reports to Sentry
(`src/web/client.tsx`).

### The website Worker holds no secrets

Its env is the public runtime config it has today (`API_URL`, `SENTRY_DSN`,
`SENTRY_ENVIRONMENT`). Anything that needs a secret or the database is an Api endpoint.

## Consequences

- Any client can do whatever the website does, through the same contract and the same auth
  (cookie in browsers, bearer token elsewhere, see `src/api/auth.ts`).
- The website server does an Api round trip per uncached loader on the first load. That is the
  price of server rendering with a separate Api, and a service binding is the fix if it shows up
  in traces.
- Every new feature touches three places: the contract, the Api handler, and a query options
  factory, with `bun run api:generate` in between. That is more work than a server function, in
  exchange for an API other clients can use.
- The generated types are committed and go stale if the contract changes without regenerating.
  The diff of `openapi.json` also shows every change to the API in review.
- The website doesn't validate responses at runtime. It trusts the Api, which encodes every
  response through the contract's Schemas.
- The first slice migrates `/me` and the session to the contract, adds the isomorphic client and
  the Query integration, and moves `getSession` off server functions.

## Alternatives considered

- **Server functions as the data layer.** Fewer files per feature, but it builds a second API
  only the website can call. Rejected for the reasons in Context.
- **A plain Vite SPA.** Simplest, and what opencode and t3code use, but they are local developer
  tools with returning, signed-in users. Our cold load from a QR code needs content in the first
  response.
- **React Server Components** (`@vitejs/plugin-rsc`, RedwoodSDK, Waku). They also need React on
  a server per request, so they add the same extra tier as Start. They help most on content-heavy
  pages, and most of ours are interactive. No comparable app we found uses them with a separate API.
- **Effect's `HttpApiClient` in the website.** Typed straight from the contract with no codegen
  step, but it put Effect, Schema and the HTTP client into the browser: about 55 kB gzipped,
  against about 2 kB for `openapi-fetch`. The participant pages load on phones over mobile data.
- **tRPC (the old app).** Typed for TypeScript clients only, and has no OpenAPI for others.
- **Effect atoms (`@effect/atom-react`) as the client cache.** It works (t3code uses it), but
  TanStack Query integrates with the router's server rendering out of the box.

## Open questions

- Does the dashboard (`_authed/`) turn server rendering off (`ssr: false`)? Decide when a heavy
  client-only editor, such as the contact sheet grid, causes hydration problems.
- Should the website call the Api through a service binding, and does Alchemy support binding a
  `Website.Vite` to a `Worker`?
- Versioning the API is deferred until a second client ships.
