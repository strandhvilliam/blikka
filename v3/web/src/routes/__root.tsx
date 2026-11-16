import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Scripts, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { Preferences } from "@ui-sdk/react/preferences";
import { env } from "@/lib/env.ts";
import appCss from "../styles.css?url";
import { captureServerError } from "@/lib/sentry.ts";
import { sessionQuery } from "@/api/session.ts";
import { colorScheme } from "@/lib/colorScheme.ts";

// The browser's config comes from the server at runtime (read from these meta tags by
// web/src/lib/meta.ts), so one build serves every stage.
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
    links: [{ rel: "stylesheet", href: appCss }],
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
  // Preferences' inline script sets data-color-scheme on <html> before React hydrates it.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Preferences preferences={[colorScheme]}>{children}</Preferences>
        <Scripts />
      </body>
    </html>
  );
}

function RootError() {
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
