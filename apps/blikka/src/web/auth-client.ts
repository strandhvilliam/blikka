import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { meta } from "./meta.ts";

// The Api is on its own origin; its session cookie is same-site, so the browser sends it along.
// Only the browser calls the Api through this client, so the server leaves the URL unset.
export const authClient = createAuthClient({
  baseURL: typeof document === "undefined" ? undefined : `${meta("api-url")}/auth`,
  plugins: [emailOTPClient()],
});
