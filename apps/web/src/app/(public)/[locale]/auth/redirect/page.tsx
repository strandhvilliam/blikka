import { getAppSession } from "@/lib/auth/server"
import { getDefaultPostLoginPath } from "@/lib/auth/redirect"
import { serverRuntime } from "@/lib/server-runtime"

import { getPermissions } from "@blikka/api/trpc/utils"
import { redirect } from "next/navigation"

export default async function AuthRedirectPage() {
  const session = await getAppSession()

  if (!session) {
    redirect("/auth/login")
  }

  const permissions = await serverRuntime.runPromise(getPermissions({ userId: session.user.id }))

  redirect(getDefaultPostLoginPath(permissions))
}
