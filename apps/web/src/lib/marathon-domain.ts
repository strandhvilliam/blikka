import { rootDomain } from "@/config"

/** Same inputs middleware uses to resolve `x-marathon-domain`. */
export type MarathonDomainLocation = {
  host: string
  href: string
  pathname: string
}

/**
 * Marathon / tenant slug for routing and tRPC headers.
 *
 * - **Production:** subdomain of `rootDomain` (see `proxy.ts`).
 * - **Localhost:** path `/admin|live|staff/:slug/...` first, else `*.localhost` host label.
 */
export function marathonDomainFromLocation(loc: MarathonDomainLocation): string | null {
  const hostname = loc.host.split(":")[0]
  const isLocal = loc.href.includes("localhost") || loc.href.includes("127.0.0.1")

  if (isLocal) {
    const segments = loc.pathname.split("/").filter(Boolean)
    const root = segments[0]
    if (
      (root === "admin" || root === "live" || root === "staff") &&
      typeof segments[1] === "string" &&
      segments[1].length > 0
    ) {
      return segments[1].split("?")[0] ?? null
    }

    if (hostname.includes(".localhost")) {
      const sub = hostname.split(".")[0]
      return sub.length > 0 ? sub : null
    }

    return null
  }

  const rootFormatted = rootDomain.split(":")[0]
  const isSubdomain =
    hostname !== rootFormatted &&
    hostname !== `www.${rootFormatted}` &&
    hostname.endsWith(`.${rootFormatted}`)

  return isSubdomain ? hostname.replace(`.${rootFormatted}`, "") : null
}
