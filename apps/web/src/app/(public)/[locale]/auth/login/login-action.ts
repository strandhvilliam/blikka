"use server"

import { Auth } from "@/lib/auth/server"
import { Action, toActionResponse } from "@/lib/next-utils"
import { loginRatelimit, getClientIp } from "@/lib/ratelimit"
import { Schema, Effect } from "effect"
import { headers } from "next/headers"

class LoginError extends Schema.TaggedErrorClass<LoginError>()("LoginError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

const _loginAction = Effect.fn("@blikka/web/loginAction")(function* ({ email }: { email: string }) {
  const auth = yield* Auth
  const readonlyHeaders = yield* Effect.tryPromise(() => headers())
  const ip = getClientIp(readonlyHeaders)
  const allowed = yield* Effect.tryPromise(() => loginRatelimit.limit(ip))
  if (!allowed) {
    yield* Effect.fail(
      new LoginError({ message: "Too many login attempts. Please try again later." }),
    )
  }
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
