import * as Alchemy from "alchemy";
import * as Axiom from "@alchemy.run/axiom";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { SentryDsn } from "./src/api/observability.ts";
import { Hostnames } from "./src/domain.ts";
import Api from "./src/api/worker.ts";

export const Website = Cloudflare.Website.Vite(
  "Website",
  Effect.gen(function* () {
    const api = yield* Api;
    return {
      domain: (yield* Hostnames)?.website,
      env: {
        // Read at runtime by the server and handed to the browser (src/web/routes/__root.tsx), so one
        // build serves every stage. The browser calls the Api directly; an empty DSN turns Sentry off.
        API_URL: api.url.as<string>(),
        SENTRY_DSN: Option.getOrElse(yield* SentryDsn, () => ""),
        SENTRY_ENVIRONMENT: yield* Stage,
      },
    };
  }).pipe(Effect.orDie),
);

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "Blikka",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Axiom.providers()),
    state: Cloudflare.state(),
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
