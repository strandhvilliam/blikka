import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { env } from "../env.ts";
import { captureServerError } from "../sentry.ts";
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
  // A failed root (the Api is down) renders the error page inside the document, not in place of it.
  shellComponent: RootDocument,
  errorComponent: RootError,
  // While rendering on the server, failed loaders become an error page without throwing. Only the
  // root's are reported here: when the root fails the page has no DSN, so the browser can't report
  // it. Any other route's failure reaches the browser with the page and is reported there.
  onError: captureServerError,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootError(_: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main>
      <p>Something went wrong.</p>
      <button type="button" onClick={() => router.invalidate()}>
        Try again
      </button>
    </main>
  );
}
