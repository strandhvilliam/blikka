import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DEFAULT_LOCALE, protocol, rootDomain } from "@/config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function buildS3Url(bucketName?: string, key?: string | null) {
  if (!bucketName || !key) return undefined
  return `https://${bucketName}.s3.eu-north-1.amazonaws.com/${key}`
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

/** Public Blikka platform terms (`[locale]/terms-and-conditions`), respects `localePrefix: "as-needed"`. */
export const formatPlatformTermsPathname = (locale: string) =>
  locale === DEFAULT_LOCALE ? "/terms-and-conditions" : `/${locale}/terms-and-conditions`

export const formatDomainPathname = (
  pathname: string,
  domain?: string,
  site: "admin" | "live" | "staff" = "admin",
) => {
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

export const formatDomainLink = (
  pathname: string,
  domain?: string,
  site: "admin" | "live" | "staff" = "admin",
) => {
  if (!domain) return pathname

  const path = formatDomainPathname(pathname, domain, site)

  if (process.env.NODE_ENV === "production") {
    return `${protocol}://${domain}.${rootDomain}${path}`
  }

  // For local development
  return `${protocol}://${rootDomain}${path}`
}
