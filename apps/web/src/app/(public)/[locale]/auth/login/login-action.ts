"use server"

import { Auth } from "@/lib/auth/server"
import { Action, toActionResponse } from "@/lib/next-utils"
import { Data, Effect } from "effect"
import { headers } from "next/headers"

class LoginError extends Data.TaggedError("LoginError")<{
  message?: string
  cause?: unknown
}> {}

const _loginAction = Effect.fn("@blikka/web/loginAction")(function* ({ email }: { email: string }) {
  const auth = yield* Auth
  const readonlyHeaders = yield* Effect.tryPromise(() => headers())
  yield* Effect.tryPromise({
    try: () =>
      auth.api.sendVerificationOTP({
        headers: readonlyHeaders,
        body: {
          email,
          type: "sign-in",
        },
      }),
    catch: (error) =>
      new LoginError({
        cause: error,
        message: "Failed to send verification OTP",
      }),
  })
}, toActionResponse)

export const loginAction = async (input: { email: string }) => Action(_loginAction)(input)
