import { getAppSession } from "@/lib/auth/server"
import { getDefaultPostLoginPath } from "@/lib/auth/redirect"
import { serverRuntime } from "@/lib/server-runtime"

import { getPermissions } from "@blikka/api/trpc/utils"
import { Option } from "effect"
import { redirect } from "next/navigation"

export default async function AuthRedirectPage() {
  const session = await serverRuntime.runPromise(getAppSession())

  if (Option.isNone(session)) {
    redirect("/auth/login")
  }

  const permissions = await serverRuntime.runPromise(getPermissions({ userId: session.value.user.id }))

  redirect(getDefaultPostLoginPath(permissions))
}
