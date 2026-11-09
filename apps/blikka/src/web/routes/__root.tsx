import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "../env.ts";
import { sessionQuery } from "../session.ts";

// The browser's config comes from the server at runtime (read from these meta tags by
// src/web/meta.ts), so one build serves every stage.
const getPublicConfig = createServerFn().handler(() => ({
  apiUrl: env.API_URL,
  sentryDsn: env.SENTRY_DSN,
  sentryEnvironment: env.SENTRY_ENVIRONMENT,
}));

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Runs on every navigation but asks the Api only when the cached session is stale (fetchQuery,
  // unlike ensureQueryData, refetches stale data). Routes read it from their context.
  beforeLoad: async ({ context }) => ({
    session: await context.queryClient.fetchQuery(sessionQuery),
  }),
  loader: () => getPublicConfig(),
  // Loaded once with the document; client-side navigations reuse it.
  staleTime: Infinity,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Blikka" },
      { name: "api-url", content: loaderData?.apiUrl },
      { name: "sentry-dsn", content: loaderData?.sentryDsn },
      { name: "sentry-environment", content: loaderData?.sentryEnvironment },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
