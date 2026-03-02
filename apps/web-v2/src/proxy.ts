import { type NextRequest, NextResponse } from "next/server"
import { protocol, rootDomain } from "./config"
import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing.public"

function withDomainHeader(request: NextRequest, subdomain: string) {
  const headers = new Headers(request.headers)
  headers.set("x-marathon-domain", subdomain)
  return { request: { headers } }
}

function extractSubdomain(request: NextRequest): string | null {
  const url = request.url
  const host = request.headers.get("host") || ""
  const hostname = host.split(":")[0]

  // Local development environment
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    // Try to extract subdomain from the full URL

    const path = url.slice(url.indexOf("localhost")).split("/")
    if (path.at(1) === "admin" || path.at(1) === "live" || path.at(1) === "staff") {
      return path.at(2) ?? null
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
    const requestWithDomainHeader = withDomainHeader(request, subdomain)

    if (pathname.startsWith("/auth")) {
      const authUrl = new URL(`${protocol}://www.${rootDomain}/${pathname}`)
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
        return NextResponse.rewrite(new URL(rewritePath, request.url), requestWithDomainHeader)
      }
      // If already has subdomain, pass through and attach the subdomain to request headers
      return NextResponse.next(requestWithDomainHeader)
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
        return NextResponse.rewrite(new URL(rewritePath, request.url), requestWithDomainHeader)
      }
      // If already has subdomain, pass through with subdomain request header
      return NextResponse.next(requestWithDomainHeader)
    }

    if (pathname.startsWith("/staff")) {
      const staffWithSubdomain = `/staff/${subdomain}`
      if (!pathname.startsWith(staffWithSubdomain)) {
        const restOfPath = pathname === "/staff" ? "" : pathname.slice(6)
        const rewritePath = `${staffWithSubdomain}${restOfPath}`
        return NextResponse.rewrite(new URL(rewritePath, request.url), requestWithDomainHeader)
      }

      return NextResponse.next(requestWithDomainHeader)
    }

    if (pathname === "/") {
      return NextResponse.redirect(new URL(`/live`, request.url))
    }
  }

  // When accessing the admin root domain but no subdomain is present, redirect domain selector
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin") {
      // If the path is just /admin, pass through
      return NextResponse.next()
    }
    // if localhost, dont rewrite
    if (request.url.includes("localhost")) {
      console.log("localhost, dont rewrite")
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL(`/admin`, request.url))
  }

  if (pathname.startsWith("/staff")) {
    if (pathname === "/staff") {
      return NextResponse.next()
    }
    if (request.url.includes("localhost")) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL(`/staff`, request.url))
  }

  // On the root domain, allow normal access
  return createMiddleware(routing)(request)
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.well-known|[\\w-]+\\.\\w+).*)"],
}
