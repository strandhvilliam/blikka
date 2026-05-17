import "server-only"

import {
  getPermissions,
  type Permission,
} from "@blikka/api/trpc/utils"
import { redirect, RedirectType } from "next/navigation"
import { getDefaultPostLoginPath, getPortalForRole } from "./redirect"
import { getAppSession } from "./server"
import { formatDomainPathname } from "@/lib/utils"
import { serverRuntime } from "@/lib/server-runtime"

type Role = "admin" | "staff"

export async function getUserPermissions(userId: string | undefined) {
  return serverRuntime.runPromise(getPermissions({ userId }))
}

export async function getCurrentUserPermissions() {
  const session = await getAppSession()
  const permissions = await getUserPermissions(session?.user.id)

  return { session, permissions }
}

export async function getPostLoginPathForCurrentUser() {
  const { permissions } = await getCurrentUserPermissions()
  return getDefaultPostLoginPath(permissions)
}

export async function requireDomainAccess({
  domain,
  roles,
  next,
  portal,
}: {
  domain: string
  roles: readonly Role[]
  next: string
  portal: Role
}): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof getAppSession>>>
  permissions: Permission[]
  permission: Permission
}> {
  const session = await getAppSession()

  if (!session) {
    redirect(`/auth/login?next=${encodeURIComponent(next)}`, RedirectType.replace)
  }

  const permissions = await getUserPermissions(session.user.id)
  const permission = permissions.find((candidate) => candidate.domain === domain)

  if (!permission) {
    redirect(getDefaultPostLoginPath(permissions), RedirectType.replace)
  }

  if (!roles.includes(permission.role as Role)) {
    const destinationPortal = getPortalForRole(permission.role)
    const pathname = destinationPortal === "admin" ? "/admin/dashboard" : "/staff"

    redirect(
      formatDomainPathname(pathname, domain, destinationPortal),
      RedirectType.replace,
    )
  }

  if (portal === "admin" && permission.role !== "admin") {
    redirect(formatDomainPathname("/staff", domain, "staff"), RedirectType.replace)
  }

  return { session, permissions, permission }
}
