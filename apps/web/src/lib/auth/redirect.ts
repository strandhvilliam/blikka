import { formatDomainLink } from "@/lib/utils"

type PermissionLike = {
  role: string
}

type MarathonAccessLike = {
  domain?: string | null
  role?: string | null
}

export function getPortalForRole(role?: string | null): "admin" | "staff" {
  return role === "staff" ? "staff" : "admin"
}

export function getDefaultPortalFromPermissions(
  permissions: readonly PermissionLike[],
): "admin" | "staff" {
  if (permissions.some((permission) => permission.role === "admin")) {
    return "admin"
  }

  if (permissions.some((permission) => permission.role === "staff")) {
    return "staff"
  }

  return "admin"
}

export function getDefaultPostLoginPath(permissions: readonly PermissionLike[]): string {
  return `/${getDefaultPortalFromPermissions(permissions)}`
}

export function getMarathonDestination(marathon: MarathonAccessLike): string {
  const portal = getPortalForRole(marathon.role)
  const pathname = portal === "admin" ? "/admin/dashboard" : "/staff"

  return formatDomainLink(pathname, marathon.domain ?? undefined, portal)
}
