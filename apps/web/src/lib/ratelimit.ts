import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "@blikka/login",
})

export const getStartedRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "10 m"),
  prefix: "@blikka/get-started",
})

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "anonymous"
  return headers.get("x-real-ip") ?? "anonymous"
}

// export const checkLoginRateLimit = async (identifier: string) => {
//   const { success } = await loginRatelimit.limit(identifier)
//   return success
// }

// export const checkGetStartedRateLimit = async (identifier: string) => {
//   const { success } = await getStartedRatelimit.limit(identifier)
//   return success
// }
