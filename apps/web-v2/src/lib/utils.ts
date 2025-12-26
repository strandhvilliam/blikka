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
