import * as Sentry from "@sentry/react";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { meta } from "@/lib/meta.ts";

Sentry.init({ dsn: meta("sentry-dsn"), environment: meta("sentry-environment") });

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
