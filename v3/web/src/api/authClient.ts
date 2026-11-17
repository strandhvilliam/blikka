import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { meta } from "@/lib/meta.ts";

export const authClient = createAuthClient({
  baseURL: typeof document === "undefined" ? undefined : `${meta("api-url")}/auth`,
  plugins: [emailOTPClient()],
});
