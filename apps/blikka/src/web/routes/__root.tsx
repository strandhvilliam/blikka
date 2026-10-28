import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "../env.ts";

// The browser's Sentry config comes from the server at runtime (read by src/web/client.tsx from
// these meta tags), so one build serves every stage.
const getSentryConfig = createServerFn().handler(() => ({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT,
}));

export const Route = createRootRoute({
  loader: () => getSentryConfig(),
  // Loaded once with the document; client-side navigations reuse it.
  staleTime: Infinity,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Blikka" },
      { name: "sentry-dsn", content: loaderData?.dsn },
      { name: "sentry-environment", content: loaderData?.environment },
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
