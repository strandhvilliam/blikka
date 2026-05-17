import { getAppSession } from "@/lib/auth/server"
import { getDefaultPostLoginPath } from "@/lib/auth/redirect"
import { getUserPermissions } from "@/lib/auth/permissions"
import { redirect } from "next/navigation"

export default async function AuthRedirectPage() {
  const session = await getAppSession()

  if (!session) {
    redirect("/auth/login")
  }

  const permissions = await getUserPermissions(session.user.id)

  redirect(getDefaultPostLoginPath(permissions))
}
