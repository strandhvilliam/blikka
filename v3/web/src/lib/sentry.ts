import * as Sentry from "@sentry/cloudflare";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";

export const captureServerError = createIsomorphicFn().server((cause: unknown) => {
  if (isRedirect(cause) || isNotFound(cause)) {
    return;
  }

  Sentry.captureException(cause, { mechanism: { type: "auto.tanstackstart", handled: false } });
});
