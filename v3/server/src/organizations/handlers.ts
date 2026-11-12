import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { Organizations } from "./service.ts";

// Organizations is built per request (api.ts), so it's read inside each handler.
export const OrganizationsHandlers = HttpApiBuilder.group(Api, "organizations", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        return yield* (yield* Organizations).list(yield* CurrentUser);
      }),
    )
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        return yield* (yield* Organizations).create(yield* CurrentUser, payload.name);
      }),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        return yield* (yield* Organizations).get(yield* CurrentUser, params.id);
      }),
    ),
);
