import { type NextRequest, NextResponse } from "next/server"
import { protocol, rootDomain } from "./config"
import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing.public"
import { marathonDomainFromLocation } from "./lib/marathon-domain"

function withDomainHeader(request: NextRequest, subdomain: string) {
  const headers = new Headers(request.headers)
  console.log("setting domain header", subdomain)
  headers.set("x-marathon-domain", subdomain)
  return { request: { headers } }
}

function extractSubdomain(request: NextRequest): string | null {
  return marathonDomainFromLocation({
    host: request.headers.get("host") || "",
    href: request.url,
    pathname: request.nextUrl.pathname,
  })
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
