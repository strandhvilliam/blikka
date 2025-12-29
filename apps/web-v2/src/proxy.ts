import { type NextRequest, NextResponse } from "next/server"
import { protocol, rootDomain } from "./config"
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
    if (pathname.startsWith("/auth")) {
      const authUrl = new URL(`${protocol}://www.${rootDomain}/auth`)
      return NextResponse.redirect(authUrl)
    }

    // For admin routes on a subdomain, inject the subdomain into the path
    if (pathname.startsWith("/admin")) {
      // Check if the subdomain is already in the path to avoid double rewriting
      const adminWithSubdomain = `/admin/${subdomain}`
      if (!pathname.startsWith(adminWithSubdomain)) {
        // Inject subdomain: /admin/dashboard -> /admin/uppis/dashboard
        const restOfPath = pathname === "/admin" ? "" : pathname.slice(6) // Remove "/admin"
        const rewritePath = `${adminWithSubdomain}${restOfPath}`
        console.log("rewrite to", rewritePath)
        return NextResponse.rewrite(new URL(rewritePath, request.url))
      }
      // If already has subdomain, pass through
      return NextResponse.next()
    }

    // For live routes on a subdomain, inject the subdomain into the path
    if (pathname.startsWith("/live")) {
      // Check if the subdomain is already in the path to avoid double rewriting
      const liveWithSubdomain = `/live/${subdomain}`
      if (!pathname.startsWith(liveWithSubdomain)) {
        // Inject subdomain: /live/submissions -> /live/uppis/submissions
        const restOfPath = pathname === "/live" ? "" : pathname.slice(5) // Remove "/live"
        const rewritePath = `${liveWithSubdomain}${restOfPath}`
        console.log("rewrite to", rewritePath)
        return NextResponse.rewrite(new URL(rewritePath, request.url))
      }
      // If already has subdomain, pass through
      return NextResponse.next()
    }

    if (pathname === "/") {
      return NextResponse.redirect(new URL(`/live/${subdomain}`, request.url))
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
