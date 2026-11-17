import { createMiddleware, createStart } from "@tanstack/react-start";
import { captureServerError } from "@/lib/sentry.ts";

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
