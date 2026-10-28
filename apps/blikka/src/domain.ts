import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";

// The domain the `prod` stage is served on: the website at the apex and the Api at api.<domain>, so
// the Api's auth cookies are same-site for the website. Its DNS must be on Cloudflare. Unset, every
// stage runs on workers.dev (and on localhost under `alchemy dev`).
const productionDomain: string | undefined = undefined;

export const Hostnames = Effect.gen(function* () {
  const stage = yield* Stage;
  if (stage !== "prod" || productionDomain === undefined) return undefined;
  return { website: productionDomain, api: `api.${productionDomain}` };
});
