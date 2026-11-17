import * as cf from "cloudflare:workers";

export type WebsiteEnv = {
  API_URL: string;
  SENTRY_DSN: string;
  SENTRY_ENVIRONMENT: string;
};

// SAFETY: alchemy.run.ts sets every WebsiteEnv key on the Website, checked there with satisfies.
export const env = new Proxy({} as WebsiteEnv, {
  get(_, prop) {
    // SAFETY: as above; prop is a WebsiteEnv key.
    return cf.env[prop as keyof typeof cf.env];
  },
});
