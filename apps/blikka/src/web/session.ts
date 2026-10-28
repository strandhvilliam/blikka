import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "./env.ts";

// The session cookie is shared with the website (see src/api/auth.ts), so the server asks the Api
// with it, like any other client would. Null when signed out.
export const getSession = createServerFn().handler(async () => {
  const cookie = getRequestHeader("cookie");
  if (!cookie) return null;
  const api = createAuthClient({ baseURL: `${env.API_URL}/auth`, plugins: [emailOTPClient()] });
  const { data, error } = await api.getSession({ fetchOptions: { headers: { cookie } } });
  if (error) throw new Error(`Could not get the session: ${error.status} ${error.message}`);
  return data;
});
