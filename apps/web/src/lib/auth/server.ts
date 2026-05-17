import "server-only"

import { BetterAuthService, type Session } from "@blikka/auth"
import { headers } from "next/headers"
import { serverRuntime } from "@/lib/server-runtime"
export { AuthConfigLayer, AuthLayer } from "./layer"

export function getAuth() {
  return serverRuntime.runPromise(BetterAuthService)
}

export async function getAppSession(): Promise<Session | null> {
  const auth = await getAuth()
  return auth.api.getSession({
    headers: await headers(),
  })
}

export { BetterAuthService as Auth }
