import * as cf from "cloudflare:workers";
import type { WebsiteEnv } from "../../alchemy.run.ts";

// TanStack Start's dev server evaluates route modules outside a request, so read env lazily.
export const env = new Proxy({} as WebsiteEnv, {
  get(_, prop) {
    return cf.env[prop as keyof typeof cf.env];
  },
});
