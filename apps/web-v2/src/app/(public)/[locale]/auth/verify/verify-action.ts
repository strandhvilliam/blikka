"use server"

import { Auth } from "@/lib/auth/server"
import { Action, toActionResponse } from "@/lib/next-utils"
import { Data, Effect } from "effect"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

class VerifyError extends Data.TaggedError("VerifyError")<{
  message?: string
  cause?: unknown
}> {}

const _verifyAction = Effect.fn("@blikka/web/verifyAction")(function* ({
  email,
  otp,
}: {
  email: string
  otp: string
}) {
  const auth = yield* Auth
  const readonlyHeaders = yield* Effect.tryPromise(() => headers())
  yield* Effect.tryPromise({
    try: () =>
      auth.api.signInEmailOTP({
        headers: readonlyHeaders,
        body: {
          email,
          otp,
        },
      }),
    catch: (error) =>
      new VerifyError({
        cause: error,
        message: error instanceof Error ? error.message : "Failed to verify email",
      }),
  })

  redirect("/marathon/")
}, toActionResponse)

export const verifyAction = async (input: { email: string; otp: string }) =>
  Action(_verifyAction)(input)
