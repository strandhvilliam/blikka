import * as Alchemy from "alchemy";
import * as Axiom from "@alchemy.run/axiom";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { SentryDsn } from "./src/api/observability.ts";
import Api from "./src/api/worker.ts";

export const Website = Cloudflare.Website.Vite(
  "Website",
  Effect.gen(function* () {
    return {
      env: {
        API: Api,
        // Read at runtime by the server and handed to the browser (src/web/routes/__root.tsx), so one
        // build serves every stage. An empty DSN turns Sentry off.
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
