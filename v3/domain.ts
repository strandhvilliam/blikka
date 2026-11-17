import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";

const productionDomain: string | undefined = undefined;

export const Hostnames = Effect.gen(function* () {
  const stage = yield* Stage;

  if (stage !== "prod" || productionDomain === undefined) {
    return undefined;
  }

  return { website: productionDomain, api: `api.${productionDomain}` };
});
