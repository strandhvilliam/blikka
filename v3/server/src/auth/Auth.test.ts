import { beforeEach, expect, test } from "bun:test";
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
import { Auth, AuthenticatedLive, disabledAuthPaths, EntrySessionLive, makeAuth } from "./Auth.ts";
import { Authenticated } from "./Authenticated.ts";
import { CurrentUser } from "./CurrentUser.ts";
import { EntryCaller, EntrySession } from "./EntrySession.ts";

const website = "https://blikka.test";
const sessionUser = { id: "u1", email: "a@b.c", name: "A", platformRole: "superadmin" };

// SAFETY: authenticate reads only options.trustedOrigins and api.getSession, the two faked here.
const FakeAuth = Layer.succeed(Auth)({
  options: { trustedOrigins: [website] },
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      sessionLookups.push(headers.get("authorization"));

      return headers.get("cookie") === "session=ok" || headers.get("authorization") === "Bearer ok"
        ? { user: sessionUser, session: {} }
        : null;
    },
  },
} as Auth["Service"]);

let handlerRuns = 0;
let sessionLookups: Array<string | null> = [];

beforeEach(() => {
  handlerRuns = 0;
  sessionLookups = [];
});

const TestApi = HttpApi.make("test")
  .add(
    HttpApiGroup.make("probe")
      .add(HttpApiEndpoint.get("read", "/read", { success: User }))
      .add(HttpApiEndpoint.post("write", "/write", { payload: Schema.Struct({}), success: User }))
      .middleware(Authenticated),
  )
  .add(
    HttpApiGroup.make("guest")
      .add(
        HttpApiEndpoint.post("enter", "/enter", {
          payload: Schema.Struct({}),
          success: Schema.Struct({ user: Schema.NullOr(User), guest_token: Schema.NullOr(Schema.String) }),
        }),
      )
      .middleware(EntrySession),
  );

const returnCurrentUser = CurrentUser.useSync((user) => {
  handlerRuns++;

  return user;
});

const { handler } = HttpRouter.toWebHandler(
  HttpApiBuilder.layer(TestApi).pipe(
    Layer.provide(
      Layer.mergeAll(
        HttpApiBuilder.group(TestApi, "probe", (handlers) =>
          handlers.handle("read", () => returnCurrentUser).handle("write", () => returnCurrentUser),
        ).pipe(Layer.provide(AuthenticatedLive)),
        HttpApiBuilder.group(TestApi, "guest", (handlers) =>
          handlers.handle("enter", () =>
            EntryCaller.useSync(({ user, guestToken }) => {
              handlerRuns++;

              return { user, guest_token: guestToken };
            }),
          ),
        ).pipe(Layer.provide(EntrySessionLive)),
      ),
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
      // oxlint-disable-next-line unicorn/no-invalid-fetch-options -- body is undefined for GET
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
    // SAFETY: the requests below are refused or answered before Better Auth touches the database.
    {} as Db["Service"],
    {
      secret: Redacted.make("s".repeat(32)),
      baseURL: "https://api.blikka.test",
      websiteURL: website,
      google: Option.none(),
    },
    undefined,
    async () => {},
  );

  const status = async (path: string) =>
    (await auth.handler(new Request(`https://api.blikka.test/auth${path}`, { method: "POST" }))).status;

  for (const path of disabledAuthPaths) {
    expect(await status(path)).toBe(404);
  }

  expect(await status("/email-otp/send-verification-otp")).not.toBe(404);
  expect(await status("/sign-in/email-otp")).not.toBe(404);
});

test("EntrySession lets a caller with nothing through, and a session as its user", async () => {
  expect(await (await request("POST", "/enter", { origin: website })).json()).toEqual({
    user: null,
    guest_token: null,
  });
  const response = await request("POST", "/enter", { cookie: "session=ok", origin: website });
  expect(await response.json()).toEqual({ user: { id: "u1", email: "a@b.c", name: "A" }, guest_token: null });
});

test("EntrySession hands a prefixed bearer to the handler as a guest token, and keeps it from Better Auth", async () => {
  const headers = { origin: website, cookie: "session=ok", authorization: "Bearer blikka_pgt_abc" };
  expect(await (await request("POST", "/enter", headers)).json()).toEqual({
    user: { id: "u1", email: "a@b.c", name: "A" },
    guest_token: "blikka_pgt_abc",
  });
  expect(sessionLookups).toEqual([null]);
  const session = await request("POST", "/enter", { authorization: "Bearer ok" });
  expect(await session.json()).toEqual({ user: { id: "u1", email: "a@b.c", name: "A" }, guest_token: null });
});

test("EntrySession refuses a cookie write from another origin, and the handler doesn't run", async () => {
  const response = await request("POST", "/enter", { cookie: "session=ok", origin: "https://evil.blikka.test" });
  expect(response.status).toBe(403);
  expect(handlerRuns).toBe(0);
});

const publicEndpoints: ReadonlyArray<string> = [
  "entry.competition",
  "entry.enter",
  "entry.list",
  "entry.get",
  "entry.topics",
  "entry.submit",
];

test("every contract endpoint is behind Authenticated", () => {
  const unauthenticated = Object.values(Api.groups).flatMap((group) =>
    Object.values(group.endpoints)
      .filter((endpoint) => !endpoint.middlewares.has(Authenticated))
      .map((endpoint) => `${group.identifier}.${endpoint.identifier}`),
  );

  expect(unauthenticated).toEqual([...publicEndpoints]);
});
