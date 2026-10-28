import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { Db } from "./db.ts";
import * as schema from "./schema.ts";

export const AuthConfig = Config.all({
  secret: Config.Redacted("BETTER_AUTH_SECRET"),
  // The Api's own origin; Google redirects back to it.
  baseURL: Config.String("BETTER_AUTH_URL"),
  // The website's origin: the only one allowed to call the Api with cookies, and to be redirected to.
  websiteURL: Config.String("WEBSITE_URL"),
  googleClientId: Config.String("GOOGLE_CLIENT_ID"),
  googleClientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
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
    database: drizzleAdapter(db, { provider: "pg", schema }),
    secret: Redacted.value(config.secret),
    baseURL: config.baseURL,
    basePath: "/auth",
    trustedOrigins: [config.websiteURL],
    advanced: {
      crossSubDomainCookies: { enabled: cookieDomain !== undefined, domain: cookieDomain },
    },
    // Account linking is on by default: Google and email OTP with the same verified email are one user.
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: Redacted.value(config.googleClientSecret),
        prompt: "select_account",
      },
    },
    user: {
      additionalFields: {
        platformRole: { type: "string", required: false, defaultValue: "user", input: false },
      },
    },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    plugins: [
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

export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {
  [HttpServerRespondable.symbol]() {
    return Effect.succeed(HttpServerResponse.empty({ status: 401 }));
  }
}

// A getSession rejection is an infrastructure failure (DB down), so it is a defect → 500.
export const getSession = Effect.fn("getSession")(function* () {
  const auth = yield* Auth;
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* Effect.promise(() => auth.api.getSession({ headers: new Headers(request.headers) }));
});

export const requireUser = Effect.fn("requireUser")(function* () {
  const session = yield* getSession();
  if (!session) return yield* new Unauthorized();
  return session.user;
});
