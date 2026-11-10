import * as Sentry from "@sentry/cloudflare";
import handler from "@tanstack/react-start/server-entry";
import type { WebsiteEnv } from "./env.ts";

// TanStack Start's default server entry, wrapped so errors thrown while rendering or serving are reported.
export default Sentry.withSentry<WebsiteEnv>(
  (env) => ({ dsn: env.SENTRY_DSN, environment: env.SENTRY_ENVIRONMENT }),
  { fetch: (request) => handler.fetch(request) } satisfies ExportedHandler<WebsiteEnv>,
);
