import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Effect, Schema } from "effect"
import { protocol, rootDomain } from "@/config"
import { RuntimeDependencies } from "./runtime"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatSubdomainUrl = (subdomain: string) => {
  if (process.env.NODE_ENV === "production") {
    return `${protocol}://${subdomain}.${rootDomain}`
  }
  // for local development since we don't have a subdomain
  return `${protocol}://localhost:3002/marathon/${subdomain}`
}
