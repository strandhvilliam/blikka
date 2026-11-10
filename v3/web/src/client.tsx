import * as Sentry from "@sentry/react";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { meta } from "./meta.ts";

// Before hydration, so errors during it are caught too. An empty DSN (dev, or unset) disables it.
Sentry.init({ dsn: meta("sentry-dsn"), environment: meta("sentry-environment") });

// TanStack Start's default client entry, plus React's error hooks: route errors are caught by the
// router's error boundaries and reach Sentry through `onCaughtError`. The callbacks keep the console
// logging React does when no hooks are set.
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    {
      onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
        console.warn("Uncaught error", error, errorInfo.componentStack);
      }),
      onCaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
        console.error(error, errorInfo.componentStack);
      }),
      onRecoverableError: Sentry.reactErrorHandler(),
    },
  );
});
