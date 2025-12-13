import { type NextRequest, NextResponse } from "next/server"
import { rootDomain } from "./config"
import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing.public"

function extractSubdomain(request: NextRequest): string | null {
  const url = request.url
  const host = request.headers.get("host") || ""
  const hostname = host.split(":")[0]

  // Local development environment
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    // Try to extract subdomain from the full URL
    const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/)
    if (fullUrlMatch && fullUrlMatch[1]) {
      return fullUrlMatch[1]
    }

    // Fallback to host header approach
    if (hostname.includes(".localhost")) {
      return hostname.split(".")[0]
    }

    return null
  }

  // Production environment
  const rootDomainFormatted = rootDomain.split(":")[0]

  const isSubdomain =
    hostname !== rootDomainFormatted &&
    hostname !== `www.${rootDomainFormatted}` &&
    hostname.endsWith(`.${rootDomainFormatted}`)

  return isSubdomain ? hostname.replace(`.${rootDomainFormatted}`, "") : null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const subdomain = extractSubdomain(request)

  if (subdomain) {
    // For the root path on a subdomain, rewrite to the subdomain page for admin and live
    if (pathname.includes("/admin")) {
      console.log("rewrite to", `/admin/${subdomain}`)
      return NextResponse.rewrite(new URL(`/admin/${subdomain}`, request.url))
    }
    if (pathname.includes("/live")) {
      console.log("rewrite to", `/live/${subdomain}`)
      return NextResponse.rewrite(new URL(`/live/${subdomain}`, request.url))
    }
  }

  // for the domain selector
  if (pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  // On the root domain, allow normal access
  return createMiddleware(routing)(request)
}

export const config = {
  matcher: ["/((?!api|_next|[\\w-]+\\.\\w+).*)"],
}
