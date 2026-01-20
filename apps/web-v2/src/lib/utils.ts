import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { protocol, rootDomain } from "@/config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatSubdomainUrlAdmin = (subdomain: string) => {
  if (process.env.NODE_ENV === "production") {
    return `${protocol}://${subdomain}.${rootDomain}`
  }
  // for local development since we don't have a subdomain
  return `${protocol}://localhost:3002/admin/${subdomain}`
}

export function truncate(str: string, options: { length?: number } = {}) {
  const { length = 30 } = options
  if (str.length <= length) return str
  return str.slice(0, length - 3) + "..."
}

export const formatPublicPathname = (pathname: string, domain?: string, locale?: string) => {
  if (!domain || !locale) return pathname

  if (process.env.NODE_ENV !== "production") {
    return `/${locale}/${domain}${pathname}`
  }

  return `/${locale}${pathname}`
}

export const formatDomainPathname = (pathname: string, domain?: string, site: "admin" | "live" = "admin") => {
  if (!domain) return pathname

  if (process.env.NODE_ENV !== "production") {
    // inject domain after first part of the pathname (e.g., /admin or /live)
    const parts = pathname.startsWith("/") ? pathname.slice(1).split("/") : pathname.split("/")
    if (parts.length === 0) return `/${site}/${domain}`

    const first = parts[0] || site
    const rest = parts.slice(1).join("/")
    const path = `/${first}/${domain}${rest ? `/${rest}` : ""}`
    return path
  }

  // In production, rely on subdomain routing; just return the original pathname
  return pathname
}
