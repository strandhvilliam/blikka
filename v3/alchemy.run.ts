import * as Alchemy from "alchemy";
import * as Axiom from "@alchemy.run/axiom";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { ALCHEMY_DEV } from "alchemy/Phase";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { SentryDsn } from "./server/src/observability.ts";
import { Hostnames } from "./domain.ts";
import Api from "./server/src/api.ts";
import type { WebsiteEnv } from "./web/src/env.ts";

export const Website = Cloudflare.Website.Vite(
  "Website",
  Effect.gen(function* () {
    const api = yield* Api;
    return {
      rootDir: "web",
      domain: (yield* Hostnames)?.website,
      // WEBSITE_URL (the Api's CORS and trusted origin) expects this port; without it the website takes 1338.
      dev: { port: 5173, strictPort: true },
      env: {
        // Read at runtime by the server and handed to the browser (web/src/routes/__root.tsx), so one
        // build serves every stage. The browser calls the Api directly; an empty DSN turns Sentry off.
        API_URL: api.url.as<string>(),
        SENTRY_DSN: Option.getOrElse(yield* SentryDsn, () => ""),
        SENTRY_ENVIRONMENT: yield* Stage,
        // The website declares its env itself, so it never imports this file (and through it the server).
      } satisfies Record<keyof WebsiteEnv, unknown>,
    };
  }).pipe(Effect.orDie),
);

export default Alchemy.Stack(
  "Blikka",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Axiom.providers()),
    // `alchemy dev` keeps its state in .alchemy/ so it runs without a Cloudflare account; deploys use the account's store.
    state: Layer.unwrap(
      Effect.gen(function* () {
        return (yield* ALCHEMY_DEV) ? Alchemy.localState() : Cloudflare.state();
      }).pipe(Effect.orDie),
    ),
  },
  Effect.gen(function* () {
    const api = yield* Api;
    const website = yield* Website;
    return {
      apiUrl: api.url.as<string>(),
      websiteUrl: website.url.as<string>(),
    };
  }),
);
