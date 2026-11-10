import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP } from "better-auth/plugins";
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
  // The Api's own origin; Google redirects back to it.
  baseURL: Config.String("BETTER_AUTH_URL"),
  // The website's origin: the only one allowed to call the Api with cookies, and to be redirected to.
  websiteURL: Config.String("WEBSITE_URL"),
  // Required on deployed stages. Under `alchemy dev` Google sign-in is off unless both are set.
  google: Config.flatMap(ALCHEMY_DEV, (dev) =>
    dev ? Config.option(GoogleConfig) : Config.map(GoogleConfig, Option.some),
  ),
});

// Set on a custom domain: the session cookie goes to <domain> and all its subdomains, so the
// website's server gets it too and can render signed-in pages. Unset, it stays on the Api's host
// (in dev both run on localhost, which already shares it).
type CookieDomain = string | undefined;

const makeAuth = (
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
    advanced: {
      crossSubDomainCookies: { enabled: cookieDomain !== undefined, domain: cookieDomain },
      // Postgres generates ids with the uuidv7() column default.
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
      // Browsers use the session cookie; other clients (SDKs, apps, scripts) send the same session
      // as `Authorization: Bearer <token>`, taken from the `set-auth-token` header on sign-in.
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

// A getSession rejection is an infrastructure failure (DB down), so it is a defect → 500.
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
  // The contract's error, so clients decode it; it renders itself as an empty 401.
  if (!session) return yield* new HttpApiError.Unauthorized();
  return yield* Effect.provideService(httpEffect, CurrentUser, session.user);
});

// The cast swaps Auth for its per-request marker (see Authenticated.ts). It holds because the
// middleware runs inside each request, after api.ts has provided Auth.
export const AuthenticatedLive = Layer.succeed(Authenticated)(
  authenticate as Authenticated["Service"],
);
