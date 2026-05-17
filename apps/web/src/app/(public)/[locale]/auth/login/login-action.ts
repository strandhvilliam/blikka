"use server"

import { sendSignInOtp } from "@/lib/auth/server"
import { loginRatelimit, getClientIp } from "@/lib/ratelimit"
import { headers } from "next/headers"

export async function loginAction(input: { email: string }) {
  try {
    const readonlyHeaders = await headers()
    const ip = getClientIp(readonlyHeaders)
    const allowed = await loginRatelimit.limit(ip)

    if (!allowed) {
      throw new Error("Too many login attempts. Please try again later.")
    }

    await sendSignInOtp({
      email: input.email,
      headers: readonlyHeaders,
    })

    return { data: undefined, error: null }
  } catch (error) {
    if (error instanceof Error && error.message === "Too many login attempts. Please try again later.") {
      return {
        data: undefined,
        error: error.message,
      }
    }

    console.error(error)

    return {
      data: undefined,
      error: "Unable to send verification code. Please try again.",
    }
  }
}
