import * as cf from "cloudflare:workers";

// Set by the Website in alchemy.run.ts, which checks it provides every key.
export type WebsiteEnv = {
  API_URL: string;
  SENTRY_DSN: string;
  SENTRY_ENVIRONMENT: string;
};

// TanStack Start's dev server evaluates route modules outside a request, so read env lazily.
// SAFETY: alchemy.run.ts sets every WebsiteEnv key on the Website, checked there with satisfies.
export const env = new Proxy({} as WebsiteEnv, {
  get(_, prop) {
    // SAFETY: as above; prop is a WebsiteEnv key.
    return cf.env[prop as keyof typeof cf.env];
  },
});
