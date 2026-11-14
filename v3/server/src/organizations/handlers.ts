import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { OrganizationsService } from "./service.ts";

// OrganizationsService is built per request (api.ts), so it's read inside each handler.
export const OrganizationsHandlers = HttpApiBuilder.group(Api, "organizations", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const organizations = yield* OrganizationsService;
        const user = yield* CurrentUser;
        return yield* organizations.list(user);
      }),
    )
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const organizations = yield* OrganizationsService;
        const user = yield* CurrentUser;
        return yield* organizations.create(user, payload.name);
      }),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const organizations = yield* OrganizationsService;
        const user = yield* CurrentUser;
        return yield* organizations.get(user, params.id);
      }),
    ),
);
