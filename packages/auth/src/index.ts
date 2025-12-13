import { type BetterAuthOptions, betterAuth } from "better-auth"
import { Config, Context, Effect } from "effect"
import { DrizzleClient } from "@blikka/db"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { EmailService, MagicLinkEmail, magicLinkEmailSubject, OTPEmail } from "@blikka/email"
import { nextCookies } from "better-auth/next-js"
import { bearer, emailOTP, magicLink } from "better-auth/plugins"

export class AuthConfig extends Context.Tag("AuthConfig")<
  AuthConfig,
  {
    readonly baseUrl: string
    readonly secret: string
    readonly emailConfig: {
      companyName: string
      companyLogoUrl: string
    }
  }
>() {}

const isProduction = process.env.NODE_ENV === "production"
const rootDomain = isProduction ? process.env.BLIKKA_PRODUCTION_URL : "localhost:3002"
export class BetterAuthService extends Effect.Service<BetterAuthService>()(
  "@blikka/auth/better-auth-service",
  {
    dependencies: [DrizzleClient.Default, EmailService.Default],
    effect: Effect.gen(function* () {
      const authConfig = yield* AuthConfig
      const db = yield* DrizzleClient
      const emailService = yield* EmailService

      const config = {
        database: drizzleAdapter(db, {
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
) {}

// export const initAuth = (options: {
//   baseUrl: string
//   secret: string
//   emailConfig: {
//     companyName: string
//     companyLogoUrl: string
//   }
// }) =>
//   Effect.gen(function* () {
//     const db = yield* DrizzleClient
//     const emailService = yield* EmailService

//     const config = {
//       database: drizzleAdapter(db, {
//         provider: "pg",
//       }),
//       secret: options.secret,
//       baseURL: options.baseUrl,
//       trustedOrigins: ["http://localhost:3002"],
//       plugins: [
//         magicLink({
//           sendMagicLink: async ({ email, token, url }, ctx) => {
//             console.log("Sending magic link to", email)
//             await Effect.runPromise(
//               emailService
//                 .send({
//                   to: email,
//                   subject: magicLinkEmailSubject({
//                     url,
//                     email,
//                   }),
//                   template: MagicLinkEmail({
//                     url,
//                     email,
//                     companyName: options.emailConfig.companyName,
//                     companyLogoUrl: options.emailConfig.companyLogoUrl,
//                   }),
//                 })
//                 .pipe(
//                   Effect.catchAll((error) => {
//                     console.error("Error sending magic link", error)
//                     return Effect.succeed(undefined)
//                   })
//                 )
//             )
//           },
//         }),
//         nextCookies(),
//       ],
//     } satisfies BetterAuthOptions

//     return betterAuth(config)
//   })

export type Session = ReturnType<typeof betterAuth>["$Infer"]["Session"]
