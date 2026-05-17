import { formatDomainLink } from '@/lib/utils'

type PermissionLike = {
  role: string
}

type MarathonAccessLike = {
  domain?: string | null
  role?: string | null
}

export function getPortalForRole(role?: string | null): 'admin' | 'staff' {
  return role === 'staff' ? 'staff' : 'admin'
}

export function getDefaultPortalFromPermissions(
  permissions: readonly PermissionLike[],
): 'admin' | 'staff' {
  if (permissions.some((permission) => permission.role === 'admin')) {
    return 'admin'
  }

  if (permissions.some((permission) => permission.role === 'staff')) {
    return 'staff'
  }

  return 'admin'
}

export function getDefaultPostLoginPath(permissions: readonly PermissionLike[]): string {
  return `/${getDefaultPortalFromPermissions(permissions)}`
}

export function sanitizeRedirectPath(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  try {
    const decoded = decodeURIComponent(value)

    if (!decoded.startsWith('/') || decoded.startsWith('//')) {
      return undefined
    }

    const parsed = new URL(decoded, 'http://localhost')

    if (parsed.origin !== 'http://localhost') {
      return undefined
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return undefined
  }
}

export function getMarathonDestination(marathon: MarathonAccessLike): string {
  const portal = getPortalForRole(marathon.role)
  const pathname = portal === 'admin' ? '/admin/dashboard' : '/staff'

  return formatDomainLink(pathname, marathon.domain ?? undefined, portal)
}
