"use server"

import { Auth } from "@/lib/auth/server"
import { loginRatelimit, getClientIp } from "@/lib/ratelimit"
import { serverRuntime } from "@/lib/server-runtime"
import { headers } from "next/headers"

type EmailOtpApi = {
  sendVerificationOTP(input: {
    headers: Headers
    body: {
      email: string
      type: "sign-in"
    }
  }): Promise<unknown>
}

export async function loginAction(input: { email: string }) {
  try {
    const auth = await serverRuntime.runPromise(Auth)
    const authApi = auth.api as typeof auth.api & EmailOtpApi
    const readonlyHeaders = await headers()
    const ip = getClientIp(readonlyHeaders)
    const allowed = await loginRatelimit.limit(ip)

    if (!allowed) {
      throw new Error("Too many login attempts. Please try again later.")
    }

    await authApi.sendVerificationOTP({
      headers: readonlyHeaders,
      body: {
        email: input.email,
        type: "sign-in",
      },
    })

    return { data: undefined, error: null }
  } catch (error) {
    return {
      data: undefined,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
