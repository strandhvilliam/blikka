import { beforeEach, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { Api, User } from "../contract.ts";
import type { Db } from "../db/Db.ts";
import { Auth, AuthenticatedLive, disabledAuthPaths, makeAuth } from "./Auth.ts";
import { Authenticated } from "./Authenticated.ts";
import { CurrentUser } from "./CurrentUser.ts";

const website = "https://blikka.test";
const sessionUser = { id: "u1", email: "a@b.c", name: "A", platformRole: "superadmin" };

const FakeAuth = Layer.succeed(Auth)({
  options: { trustedOrigins: [website] },
  api: {
    getSession: async ({ headers }: { headers: Headers }) =>
      headers.get("cookie") === "session=ok" || headers.get("authorization") === "Bearer ok"
        ? { user: sessionUser, session: {} }
        : null,
  },
} as unknown as Auth["Service"]);

let handlerRuns = 0;
beforeEach(() => {
  handlerRuns = 0;
});

const TestApi = HttpApi.make("test").add(
  HttpApiGroup.make("probe")
    .add(HttpApiEndpoint.get("read", "/read", { success: User }))
    .add(HttpApiEndpoint.post("write", "/write", { payload: Schema.Struct({}), success: User }))
    .middleware(Authenticated),
);

const returnCurrentUser = CurrentUser.useSync((user) => {
  handlerRuns++;
  return user;
});

const { handler } = HttpRouter.toWebHandler(
  HttpApiBuilder.layer(TestApi).pipe(
    Layer.provide(
      HttpApiBuilder.group(TestApi, "probe", (handlers) =>
        handlers.handle("read", () => returnCurrentUser).handle("write", () => returnCurrentUser),
      ).pipe(Layer.provide(AuthenticatedLive)),
    ),
    Layer.provide(HttpServer.layerServices),
    Layer.provideMerge(FakeAuth),
  ),
  { disableLogger: true },
);

const request = (method: "GET" | "POST", path: string, headers: Record<string, string> = {}) =>
  handler(
    new Request(`https://api.blikka.test${path}`, {
      method,
      headers: method === "POST" ? { "content-type": "application/json", ...headers } : headers,
      body: method === "POST" ? "{}" : undefined,
    }),
  );

test("no session is a 401, and the handler doesn't run", async () => {
  expect((await request("GET", "/read")).status).toBe(401);
  expect((await request("POST", "/write", { origin: website })).status).toBe(401);
  expect(handlerRuns).toBe(0);
});

test("a session reaches the handler as CurrentUser, encoded to the contract's fields only", async () => {
  const response = await request("GET", "/read", { cookie: "session=ok" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: "u1", email: "a@b.c", name: "A" });
});

test("a cookie write from another origin is a 403, and the handler doesn't run", async () => {
  for (const origin of ["https://evil.blikka.test", "null"]) {
    const response = await request("POST", "/write", { cookie: "session=ok", origin });
    expect(response.status).toBe(403);
  }
  expect(handlerRuns).toBe(0);
});

test("writes from the website, and token writes with no Origin, go through", async () => {
  expect((await request("POST", "/write", { cookie: "session=ok", origin: website })).status).toBe(200);
  expect((await request("POST", "/write", { authorization: "Bearer ok" })).status).toBe(200);
});

test("the emailOTP endpoints the website doesn't use are 404, and the two it uses are not", async () => {
  const auth = makeAuth(
    {} as Db["Service"],
    { secret: Redacted.make("s".repeat(32)), baseURL: "https://api.blikka.test", websiteURL: website, google: Option.none() },
    undefined,
  );
  const status = async (path: string) =>
    (await auth.handler(new Request(`https://api.blikka.test/auth${path}`, { method: "POST" }))).status;
  for (const path of disabledAuthPaths) expect(await status(path)).toBe(404);
  // Reached: refused for the missing body, not for the path.
  expect(await status("/email-otp/send-verification-otp")).not.toBe(404);
  expect(await status("/sign-in/email-otp")).not.toBe(404);
});

// Reading CurrentUser without the middleware doesn't compile, but a handler that never reads it would
// silently be public. Add a deliberately public endpoint here as "group.endpoint".
const publicEndpoints: ReadonlyArray<string> = [];

test("every contract endpoint is behind Authenticated", () => {
  const unauthenticated = Object.values(Api.groups).flatMap((group) =>
    Object.values(group.endpoints)
      .filter((endpoint) => !endpoint.middlewares.has(Authenticated))
      .map((endpoint) => `${group.identifier}.${endpoint.identifier}`),
  );
  expect(unauthenticated).toEqual([...publicEndpoints]);
});
