import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer, emailOTP } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import { ALCHEMY_DEV } from "alchemy/Phase";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import type * as HttpServerResponse from "effect/http/HttpServerResponse";
import type * as Types from "effect/Types";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { ParticipantsService } from "../participants/service.ts";
import { reportCause, SentryScope } from "../sentry/SentryScope.ts";
import { Authenticated } from "./Authenticated.ts";
import { CurrentUser } from "./CurrentUser.ts";
import { EntryCaller, EntrySession, GUEST_TOKEN_PREFIX } from "./EntrySession.ts";

const GoogleConfig = Config.all({
  clientId: Config.String("GOOGLE_CLIENT_ID"),
  clientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
});

export const AuthConfig = Config.all({
  secret: Config.Redacted("BETTER_AUTH_SECRET"),
  baseURL: Config.String("BETTER_AUTH_URL"),
  websiteURL: Config.String("WEBSITE_URL"),
  google: Config.flatMap(ALCHEMY_DEV, (dev) =>
    dev ? Config.option(GoogleConfig) : Config.map(GoogleConfig, Option.some),
  ),
});

type CookieDomain = string | undefined;

export const disabledAuthPaths = [
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/email-otp/request-password-reset",
  "/email-otp/reset-password",
  "/forget-password/email-otp",
];

const MAX_CODES_PER_HOUR = 5;

const decodeOtpRequest = Schema.decodeUnknownOption(Schema.Struct({ email: Schema.String }));

export const makeAuth = (
  db: Db["Service"],
  config: Config.Success<typeof AuthConfig>,
  cookieDomain: CookieDomain,
  claimGuestEntries: (userId: string) => Promise<void>,
) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema: model }),
    secret: Redacted.value(config.secret),
    baseURL: config.baseURL,
    basePath: "/auth",
    trustedOrigins: [config.websiteURL],
    disabledPaths: disabledAuthPaths,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const request = decodeOtpRequest(ctx.body);

        if (ctx.path !== "/email-otp/send-verification-otp" || Option.isNone(request)) {
          return;
        }

        const { email } = request.value;

        const { otpSends } = model;
        const expired = sql`${otpSends.windowStart} < now() - interval '1 hour'`;

        const [sent] = await db
          .insert(otpSends)
          .values({ email: email.toLowerCase(), count: 1, windowStart: sql`now()` })
          .onConflictDoUpdate({
            target: otpSends.email,
            set: {
              count: sql`case when ${expired} then 1 else ${otpSends.count} + 1 end`,
              windowStart: sql`case when ${expired} then now() else ${otpSends.windowStart} end`,
            },
          })
          .returning({ count: otpSends.count });

        if (sent!.count > MAX_CODES_PER_HOUR) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many codes requested. Try again in an hour.",
          });
        }
      }),
    },
    advanced: {
      crossSubDomainCookies: { enabled: cookieDomain !== undefined, domain: cookieDomain },
      database: { generateId: "uuid" },
    },
    socialProviders: Option.match(config.google, {
      onNone: () => ({}),
      onSome: ({ clientId, clientSecret }) => ({
        google: { clientId, clientSecret: Redacted.value(clientSecret), prompt: "select_account" as const },
      }),
    }),
    user: {
      additionalFields: {
        platformRole: { type: "string", required: false, defaultValue: "user", input: false },
      },
    },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    plugins: [
      bearer({ requireSignature: true }),
      emailOTP({
        sendVerificationOTP: async ({ email, otp, type }) => {
          console.log(`[auth] ${type} OTP for ${email}: ${otp}`);
        },
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          after: (session) => claimGuestEntries(session.userId),
        },
      },
    },
  });

export class Auth extends Context.Service<Auth, ReturnType<typeof makeAuth>>()("blikka/auth/Auth") {}

export const AuthLive = (config: Config.Success<typeof AuthConfig>, cookieDomain: CookieDomain) =>
  Layer.effect(
    Auth,
    Effect.gen(function* () {
      const participants = yield* ParticipantsService;
      const run = Effect.runPromiseWith(yield* Effect.context<SentryScope>());

      const claimGuestEntries = (userId: string) => {
        const claim = participants.claimGuestEntries(userId);

        return run(Effect.catchCause(claim, reportCause));
      };

      const db = yield* Db;

      return makeAuth(db, config, cookieDomain, claimGuestEntries);
    }),
  );

export const getSession = Effect.fn("Auth.getSession")(function* (headers?: Headers) {
  const auth = yield* Auth;
  const request = yield* HttpServerRequest.HttpServerRequest;
  const sessionHeaders = headers ?? new Headers(request.headers);

  return yield* Effect.promise(() => auth.api.getSession({ headers: sessionHeaders }));
});

const checkOrigin = Effect.fn("Auth.checkOrigin")(function* () {
  const auth = yield* Auth;
  const request = yield* HttpServerRequest.HttpServerRequest;
  const origin = request.headers["origin"];
  const safeMethod = request.method === "GET" || request.method === "HEAD";

  if (!safeMethod && origin !== undefined && !auth.options.trustedOrigins.includes(origin)) {
    return yield* new HttpApiError.Forbidden();
  }
});

const authenticate = Effect.fn("Auth.authenticate")(function* (
  httpEffect: Effect.Effect<HttpServerResponse.HttpServerResponse, Types.unhandled, CurrentUser>,
) {
  yield* checkOrigin();
  const session = yield* getSession();

  if (!session) {
    return yield* new HttpApiError.Unauthorized();
  }

  return yield* Effect.provideService(httpEffect, CurrentUser, session.user);
});

const entrySession = Effect.fn("Auth.entrySession")(function* (
  httpEffect: Effect.Effect<HttpServerResponse.HttpServerResponse, Types.unhandled, EntryCaller>,
) {
  yield* checkOrigin();
  const request = yield* HttpServerRequest.HttpServerRequest;
  const bearerMatch = request.headers["authorization"]?.match(/^Bearer (\S+)$/);
  const bearer = bearerMatch?.[1];
  const guestToken = bearer?.startsWith(GUEST_TOKEN_PREFIX) ? bearer : null;

  const headers = new Headers(request.headers);

  if (guestToken) {
    headers.delete("authorization");
  }

  const session = yield* getSession(headers);

  const caller = { user: session?.user ?? null, guestToken };

  return yield* Effect.provideService(httpEffect, EntryCaller, caller);
});

// SAFETY: the cast swaps Auth for its per-request marker (see Authenticated.ts). It holds because the
export const AuthenticatedLive = Layer.succeed(Authenticated)(authenticate as Authenticated["Service"]);

// SAFETY: as for AuthenticatedLive.
export const EntrySessionLive = Layer.succeed(EntrySession)(entrySession as EntrySession["Service"]);
