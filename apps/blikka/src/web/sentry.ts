import * as Sentry from "@sentry/cloudflare";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";

// For errors Start turns into a response or an error page instead of throwing, so `withSentry` in
// src/web/server.ts never sees them. A no-op in the browser, which reports through React's hooks
// (src/web/client.tsx). Redirects and not-found are navigation, not bugs.
export const captureServerError = createIsomorphicFn().server((error: unknown) => {
  if (isRedirect(error) || isNotFound(error)) return;
  Sentry.captureException(error, { mechanism: { type: "auto.tanstackstart", handled: false } });
});
