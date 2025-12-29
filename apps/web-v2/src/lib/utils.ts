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

export const formatDomainPathname = (pathname: string, domain?: string) => {
  if (!domain) return pathname

  if (process.env.NODE_ENV !== "production") {
    // inject domain after first part of the pathname (e.g., /admin or /live)
    const parts = pathname.startsWith("/") ? pathname.slice(1).split("/") : pathname.split("/")
    if (parts.length === 0) return `/admin/${domain}`

    const first = parts[0] || "live"
    const rest = parts.slice(1).join("/")
    return `/${first}/${domain}${rest ? `/${rest}` : ""}`
  }

  // In production, rely on subdomain routing; just return the original pathname
  return pathname
}
