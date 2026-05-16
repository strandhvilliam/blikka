import { type BetterAuthOptions, betterAuth } from "better-auth";
import { Context, Effect, Layer, Schema } from "effect";
import { DbLayer, UsersRepository, DrizzleClient, schema } from "@blikka/db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { EmailService, OTPEmail } from "@blikka/email";
import { nextCookies } from "better-auth/next-js";
import { RedisClient, RedisClientLayer } from "@blikka/redis";
import { bearer, emailOTP } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";

export class AuthConfig extends Context.Service<
  AuthConfig,
  {
    readonly baseUrl: string;
    readonly secret: string;
    readonly emailConfig: {
      companyName: string;
      companyLogoUrl: string;
    };
  }
>()("@blikka/auth/auth-config") {}

export class AuthConfigurationError extends Schema.TaggedErrorClass<AuthConfigurationError>()(
  "AuthConfigurationError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class AuthCallbackError extends Schema.TaggedErrorClass<AuthCallbackError>()(
  "AuthCallbackError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

type AuthRuntimeConfig = {
  readonly isProduction: boolean;
  readonly rootDomain: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
};

type SessionUser = {
  readonly id?: string | null;
  readonly email?: string | null;
};

type VerificationOTPParams = {
  readonly email: string;
  readonly otp: string;
  readonly type: string;
};

const getRequiredEnv = Effect.fn("BetterAuthService.getRequiredEnv")(function* (
  name: string,
) {
  const value = process.env[name]?.trim();
  if (!value) {
    return yield* new AuthConfigurationError({
      message: `${name} is required to configure Better Auth`,
    });
  }

  return value;
});

const makeAuthRuntimeConfig = Effect.fn(
  "BetterAuthService.makeAuthRuntimeConfig",
)(function* () {
  const isProduction = process.env.NODE_ENV === "production";
  const rootDomain = isProduction
    ? yield* getRequiredEnv("NEXT_PUBLIC_BLIKKA_PRODUCTION_URL")
    : "localhost:3002";

  const googleClientId = yield* getRequiredEnv("GOOGLE_CLIENT_ID");
  const googleClientSecret = yield* getRequiredEnv("GOOGLE_CLIENT_SECRET");

  return {
    isProduction,
    rootDomain,
    googleClientId,
    googleClientSecret,
  } satisfies AuthRuntimeConfig;
});

const makeTrustedOrigins = (rootDomain: string) => [
  `http://${rootDomain}`,
  `https://*.${rootDomain}`,
  `*.${rootDomain}`,
];

const makeCookieOptions = (runtimeConfig: AuthRuntimeConfig) =>
  ({
    crossSubDomainCookies: {
      enabled: runtimeConfig.isProduction,
      domain: `.${runtimeConfig.rootDomain}`,
    },
    defaultCookieAttributes: {
      secure: runtimeConfig.isProduction,
      sameSite: "lax",
    },
  }) satisfies BetterAuthOptions["advanced"];

export class BetterAuthService extends Context.Service<BetterAuthService>()(
  "@blikka/auth/better-auth-service",
  {
    make: Effect.gen(function* () {
      const authConfig = yield* AuthConfig;
      const runtimeConfig = yield* makeAuthRuntimeConfig();
      const { client } = yield* DrizzleClient;
      const usersRepository = yield* UsersRepository;
      const emailService = yield* EmailService;
      const redis = yield* RedisClient;

      const afterAuth = Effect.fn("BetterAuthService.afterAuth")(function* (
        user: SessionUser | undefined,
      ) {
        if (!user?.id) {
          return;
        }

        if (user.email) {
          yield* usersRepository.claimPendingUserMarathonsForUser({
            userId: user.id,
            email: user.email,
          });
        }

        yield* redis.use((client) => client.del(`permissions:${user.id}`));
      });

      const sendVerificationOTP = Effect.fn(
        "BetterAuthService.sendVerificationOTP",
      )(function* ({ email, otp, type }: VerificationOTPParams) {
        switch (type) {
          case "sign-in": {
            yield* emailService.send({
              to: email,
              subject: "Sign in to Your Account",
              template: OTPEmail({
                otp,
                username: email,
                companyName: authConfig.emailConfig.companyName,
                companyLogoUrl: authConfig.emailConfig.companyLogoUrl,
              }),
            });
            return;
          }
          case "forget-password": {
            yield* Effect.logInfo(`Register OTP for ${email}: ${otp}`);
            return;
          }
          case "email-verification": {
            yield* Effect.logInfo(`Reset OTP for ${email}: ${otp}`);
            return;
          }
          default:
            return yield* new AuthCallbackError({
              message: `Unknown OTP type: ${type}`,
            });
        }
      });

      const makeBetterAuthOptions = (): BetterAuthOptions => ({
        database: drizzleAdapter(client, {
          provider: "pg",
          schema: {
            user: schema.user,
            account: schema.account,
            session: schema.session,
            verification: schema.verification,
          },
        }),
        secret: authConfig.secret,
        baseURL: authConfig.baseUrl,
        trustedOrigins: makeTrustedOrigins(runtimeConfig.rootDomain),

        hooks: {
          after: createAuthMiddleware((ctx) =>
            Effect.runPromise(afterAuth(ctx.context.session?.user)),
          ),
        },

        socialProviders: {
          google: {
            clientId: runtimeConfig.googleClientId,
            clientSecret: runtimeConfig.googleClientSecret,
            prompt: "select_account",
          },
        },

        advanced: makeCookieOptions(runtimeConfig),
        session: {
          cookieCache: {
            enabled: true,
            maxAge: 60 * 60 * 2,
          },
        },
        plugins: [
          emailOTP({
            expiresIn: 60 * 60 * 2,
            sendVerificationOTP: (params) =>
              Effect.runPromise(sendVerificationOTP(params)),
          }),
          bearer(),
          nextCookies(),
        ],
      });

      return betterAuth(makeBetterAuthOptions());
    }),
  },
) {
  static readonly layerNoDeps = Layer.effect(this, this.make);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        DrizzleClient.layer,
        DbLayer,
        EmailService.layer,
        RedisClientLayer,
      ),
    ),
  );
}

export type Session = ReturnType<typeof betterAuth>["$Infer"]["Session"];
