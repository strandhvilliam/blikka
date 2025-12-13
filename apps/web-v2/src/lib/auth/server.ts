import "server-only"

import { AuthConfig, BetterAuthService, type Session } from "@blikka/auth"
import { Effect, Layer, Option } from "effect"
import { headers } from "next/headers"
import { protocol } from "@/config"

const baseUrl = `${protocol}://${process.env.BLIKKA_PRODUCTION_URL || "localhost:3002"}`

export const AuthConfigLayer = Layer.succeed(AuthConfig, {
  baseUrl,
  secret: process.env.BETTER_AUTH_SECRET!,
  emailConfig: {
    companyName: "Blikka",
    companyLogoUrl: "https://blikka.app/images/logo.png",
  },
})

export const AuthLayer = Layer.provide(BetterAuthService.Default, AuthConfigLayer)

export const getAppSession = Effect.fnUntraced(
  function* () {
    const auth = yield* BetterAuthService
    const readonlyHeaders = yield* Effect.tryPromise(() => headers())
    const session = yield* Effect.tryPromise(() =>
      auth.api.getSession({
        headers: readonlyHeaders,
      })
    )

    return Option.fromNullable<Session | null>(session)
  },
  Effect.tapError((error) => Effect.logError(error.message)),
  Effect.catchAll(() => Effect.succeed(Option.none<Session>()))
)

export { BetterAuthService as Auth }
