import { type BetterAuthOptions, betterAuth } from "better-auth"
import { ServiceMap, Effect, Layer } from "effect"
import { DrizzleClient } from "@blikka/db"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { EmailService, OTPEmail } from "@blikka/email"
import { nextCookies } from "better-auth/next-js"
import { bearer, emailOTP } from "better-auth/plugins"

export class AuthConfig extends ServiceMap.Service<AuthConfig, {
  readonly baseUrl: string
  readonly secret: string
  readonly emailConfig: {
    companyName: string
    companyLogoUrl: string
  }
}>()("@blikka/auth/auth-config") {
}



const isProduction = process.env.NODE_ENV === "production"
const rootDomain = isProduction ? process.env.NEXT_PUBLIC_BLIKKA_PRODUCTION_URL : "localhost:3002"
export class BetterAuthService extends ServiceMap.Service<BetterAuthService>()(
  "@blikka/auth/better-auth-service",
  {
    make: Effect.gen(function* () {
      const authConfig = yield* AuthConfig
      const { client } = yield* DrizzleClient
      const emailService = yield* EmailService

      const config = {
        database: drizzleAdapter(client, {
          provider: "pg",
        }),
        secret: authConfig.secret,
        baseURL: authConfig.baseUrl,
        trustedOrigins: [`http://${rootDomain}`, `https://*.${rootDomain}`, `*.${rootDomain}`],

        advanced: {
          crossSubDomainCookies: {
            enabled: isProduction,
            domain: `.${rootDomain}`,
          },
          defaultCookieAttributes: {
            secure: isProduction,
            sameSite: "lax",
          },
        },
        session: {
          cookieCache: {
            enabled: true,
            maxAge: 60 * 60 * 2,
          },
        },
        plugins: [
          emailOTP({
            expiresIn: 60 * 60 * 2,
            sendVerificationOTP: async ({ email, otp, type }) => {
              switch (type) {
                case "sign-in": {
                  await Effect.runPromise(
                    emailService.send({
                      to: email,
                      subject: "Sign in to Your Account",
                      template: OTPEmail({
                        otp,
                        username: email,
                        companyName: authConfig.emailConfig.companyName,
                        companyLogoUrl: authConfig.emailConfig.companyLogoUrl,
                      }),
                    })
                  )
                  break
                }
                case "forget-password":
                  console.log(`Register OTP for ${email}: ${otp}`)
                  break
                case "email-verification":
                  console.log(`Reset OTP for ${email}: ${otp}`)
                  break
                default:
                  throw new Error(`Unknown OTP type: ${type}`)
              }
            },
          }),
          bearer(),
          nextCookies(),
        ],
      } satisfies BetterAuthOptions

      return betterAuth(config)
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(DrizzleClient.layer, EmailService.layer))
  )
}

export type Session = ReturnType<typeof betterAuth>["$Infer"]["Session"]
