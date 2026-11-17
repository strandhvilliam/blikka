import * as Sentry from "@sentry/cloudflare";
import handler from "@tanstack/react-start/server-entry";
import type { WebsiteEnv } from "@/lib/env.ts";

export default Sentry.withSentry<WebsiteEnv>((env) => ({ dsn: env.SENTRY_DSN, environment: env.SENTRY_ENVIRONMENT }), {
  fetch: (request) => handler.fetch(request),
} satisfies ExportedHandler<WebsiteEnv>);
