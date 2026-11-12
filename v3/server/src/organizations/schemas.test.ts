import { expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import { PermissionDenied } from "../permissions/permissions.ts";
import { OrganizationName, OrganizationNotFound } from "./schemas.ts";

test("an organization name is trimmed, required and at most 100 characters", () => {
  const decode = Schema.decodeUnknownSync(OrganizationName);
  expect(decode("  Foto  ")).toBe("Foto");
  expect(() => decode("   ")).toThrow();
  expect(decode("a".repeat(100))).toBe("a".repeat(100));
  expect(() => decode("a".repeat(101))).toThrow();
});

test("domain errors carry their own status, so handlers don't map them", async () => {
  const TestApi = HttpApi.make("test").add(
    HttpApiGroup.make("probe")
      .add(HttpApiEndpoint.get("notFound", "/not-found", { error: OrganizationNotFound }))
      .add(HttpApiEndpoint.get("denied", "/denied", { error: PermissionDenied })),
  );
  const { handler } = HttpRouter.toWebHandler(
    HttpApiBuilder.layer(TestApi).pipe(
      Layer.provide(
        HttpApiBuilder.group(TestApi, "probe", (handlers) =>
          handlers
            .handle("notFound", () => Effect.fail(new OrganizationNotFound()))
            .handle("denied", () => Effect.fail(new PermissionDenied())),
        ),
      ),
      Layer.provide(HttpServer.layerServices),
    ),
    { disableLogger: true },
  );
  const status = async (path: string) => (await handler(new Request(`https://api.test${path}`))).status;
  expect(await status("/not-found")).toBe(404);
  expect(await status("/denied")).toBe(403);
});
