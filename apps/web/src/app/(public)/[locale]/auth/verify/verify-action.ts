"use server"

import { Auth } from "@/lib/auth/server"
import { getDefaultPostLoginPath } from "@/lib/auth/redirect"
import { Action, toActionResponse } from "@/lib/next-utils"
import { getPermissions } from "@blikka/api/trpc/utils"
import { Schema, Effect } from "effect"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

class VerifyError extends Schema.TaggedErrorClass<VerifyError>()("VerifyError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {
}

const _verifyAction = Effect.fn("@blikka/web/verifyAction")(function* ({
  email,
  otp,
  next,
}: {
  email: string
  otp: string
  next?: string
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

  const session = yield* Effect.tryPromise({
    try: () =>
      auth.api.getSession({
        headers: readonlyHeaders,
      }),
    catch: (error) =>
      new VerifyError({
        cause: error,
        message: "Failed to resolve session after verification",
      }),
  })

  const permissions = yield* getPermissions({ userId: session?.user.id })

  redirect(next ?? getDefaultPostLoginPath(permissions))
}, toActionResponse)

export const verifyAction = async (input: { email: string; otp: string; next?: string }) =>
  Action(_verifyAction)(input)
