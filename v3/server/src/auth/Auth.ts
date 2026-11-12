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
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import type * as HttpServerResponse from "effect/http/HttpServerResponse";
import type * as Types from "effect/Types";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { Authenticated } from "./Authenticated.ts";
import { CurrentUser } from "./CurrentUser.ts";

const GoogleConfig = Config.all({
  clientId: Config.String("GOOGLE_CLIENT_ID"),
  clientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
});

export const AuthConfig = Config.all({
  secret: Config.Redacted("BETTER_AUTH_SECRET"),
  baseURL: Config.String("BETTER_AUTH_URL"),
  // The only origin allowed to call the Api with cookies, and to be redirected to.
  websiteURL: Config.String("WEBSITE_URL"),
  // Required on deployed stages. Under `alchemy dev` Google sign-in is off unless both are set.
  google: Config.flatMap(ALCHEMY_DEV, (dev) =>
    dev ? Config.option(GoogleConfig) : Config.map(GoogleConfig, Option.some),
  ),
});

// Set on a custom domain, so the website's server also gets the session cookie and can render
// signed-in pages.
type CookieDomain = string | undefined;

// emailOTP endpoints the website doesn't call. check-verification-otp counts attempts without a
// lock, so parallel guesses at a sign-in code get past the 3-attempt limit; the rest are
// password and email-verification flows this Api doesn't have.
export const disabledAuthPaths = [
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/email-otp/request-password-reset",
  "/email-otp/reset-password",
  "/forget-password/email-otp",
];

const MAX_CODES_PER_HOUR = 5;

export const makeAuth = (
  db: Db["Service"],
  config: Config.Success<typeof AuthConfig>,
  cookieDomain: CookieDomain,
) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema: model }),
    secret: Redacted.value(config.secret),
    baseURL: config.baseURL,
    basePath: "/auth",
    trustedOrigins: [config.websiteURL],
    disabledPaths: disabledAuthPaths,
    hooks: {
      // Each code allows 3 guesses, so the number of codes per email is what bounds guessing at
      // someone else's. Counted per email, not per IP, so it holds against any number of IPs.
      before: createAuthMiddleware(async (ctx) => {
        const email = ctx.body?.email;
        if (ctx.path !== "/email-otp/send-verification-otp" || typeof email !== "string") return;
        const { otpSends } = model;
        const expired = sql`${otpSends.windowStart} < now() - interval '1 hour'`;
        // One statement, so parallel requests can't each read the same count.
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
          throw new APIError("TOO_MANY_REQUESTS", { message: "Too many codes requested. Try again in an hour." });
        }
      }),
    },
    advanced: {
      crossSubDomainCookies: { enabled: cookieDomain !== undefined, domain: cookieDomain },
      database: { generateId: "uuid" },
    },
    // Account linking is on by default: Google and email OTP with the same verified email are one user.
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
      // Non-browser clients send the session as `Authorization: Bearer <token>`.
      bearer({ requireSignature: true }),
      emailOTP({
        // shortcut: logs the code instead of emailing it, replace with the email service before launch.
        sendVerificationOTP: async ({ email, otp, type }) => {
          console.log(`[auth] ${type} OTP for ${email}: ${otp}`);
        },
      }),
    ],
  });

export class Auth extends Context.Service<Auth, ReturnType<typeof makeAuth>>()("blikka/auth/Auth") {}

export const AuthLive = (config: Config.Success<typeof AuthConfig>, cookieDomain: CookieDomain) =>
  Layer.effect(
    Auth,
    Effect.gen(function* () {
      return makeAuth(yield* Db, config, cookieDomain);
    }),
  );

export const getSession = Effect.fn("Auth.getSession")(function* () {
  const auth = yield* Auth;
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* Effect.promise(() => auth.api.getSession({ headers: new Headers(request.headers) }));
});

const authenticate = Effect.fn("Auth.authenticate")(function* (
  httpEffect: Effect.Effect<HttpServerResponse.HttpServerResponse, Types.unhandled, CurrentUser>,
) {
  const auth = yield* Auth;
  const request = yield* HttpServerRequest.HttpServerRequest;
  // CSRF: the session cookie is SameSite=Lax, so any subdomain of the cookie domain can still send
  // it with a POST. Browsers always send Origin on those; non-browser clients send none.
  const origin = request.headers["origin"];
  const safeMethod = request.method === "GET" || request.method === "HEAD";
  if (!safeMethod && origin !== undefined && !auth.options.trustedOrigins.includes(origin)) {
    return yield* new HttpApiError.Forbidden();
  }
  const session = yield* getSession();
  if (!session) return yield* new HttpApiError.Unauthorized();
  return yield* Effect.provideService(httpEffect, CurrentUser, session.user);
});

// The cast swaps Auth for its per-request marker (see Authenticated.ts). It holds because the
// middleware runs inside each request, after api.ts has provided Auth.
export const AuthenticatedLive = Layer.succeed(Authenticated)(
  authenticate as Authenticated["Service"],
);
