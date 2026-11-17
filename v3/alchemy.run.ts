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
import type { WebsiteEnv } from "./web/src/lib/env.ts";

export const Website = Cloudflare.Website.Vite(
  "Website",
  Effect.gen(function* () {
    const api = yield* Api;

    return {
      rootDir: "web",
      domain: (yield* Hostnames)?.website,
      dev: { port: 5173, strictPort: true },
      env: {
        API_URL: api.url.as<string>(),
        SENTRY_DSN: Option.getOrElse(yield* SentryDsn, () => ""),
        SENTRY_ENVIRONMENT: yield* Stage,
      } satisfies Record<keyof WebsiteEnv, string | Alchemy.Output<string>>,
    };
  }).pipe(Effect.orDie),
);

export default Alchemy.Stack(
  "Blikka",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Axiom.providers()),
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
