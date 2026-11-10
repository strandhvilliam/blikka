import { createMiddleware, createStart } from "@tanstack/react-start";
import { captureServerError } from "./sentry.ts";

// Sentry's `sentryGlobalFunctionMiddleware`, copied: @sentry/tanstackstart-react pulls in
// @sentry/node, which doesn't run on Workers. A failed server function becomes an error response,
// so it's reported here, where it still throws.
const sentryFunctionMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    captureServerError(error);
    throw error;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [sentryFunctionMiddleware],
}));
