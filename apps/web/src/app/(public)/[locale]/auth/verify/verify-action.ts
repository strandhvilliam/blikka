"use server"

import { getAuth } from "@/lib/auth/server"
import { getDefaultPostLoginPath } from "@/lib/auth/redirect"
import { serverRuntime } from "@/lib/server-runtime"
import { getPermissions } from "@blikka/api/trpc/utils"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

type EmailOtpApi = {
  signInEmailOTP(input: {
    headers: Headers
    body: {
      email: string
      otp: string
    }
  }): Promise<unknown>
}

export async function verifyAction(input: { email: string; otp: string; next?: string }) {
  let userId: string | undefined

  try {
    const auth = await getAuth()
    const authApi = auth.api as typeof auth.api & EmailOtpApi
    const readonlyHeaders = await headers()

    await authApi.signInEmailOTP({
      headers: readonlyHeaders,
      body: {
        email: input.email,
        otp: input.otp,
      },
    })

    const session = await auth.api.getSession({
      headers: readonlyHeaders,
    })
    userId = session?.user.id
  } catch (error) {
    return {
      data: undefined,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  const permissions = await serverRuntime.runPromise(getPermissions({ userId }))
  redirect(input.next ?? getDefaultPostLoginPath(permissions))
}
