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

const getPublicConfig = createServerFn().handler(() => ({
  apiUrl: env.API_URL,
  sentryDsn: env.SENTRY_DSN,
  sentryEnvironment: env.SENTRY_ENVIRONMENT,
}));

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ context }) => ({
    session: await context.queryClient.fetchQuery(sessionQuery),
  }),
  loader: () => getPublicConfig(),
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
  shellComponent: RootDocument,
  errorComponent: RootError,
  onError: captureServerError,
});

function RootDocument({ children }: { children: ReactNode }) {
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
