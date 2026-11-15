import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { MembersService } from "./service.ts";

export const MembersHandlers = HttpApiBuilder.group(Api, "members", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const members = yield* MembersService;
        const user = yield* CurrentUser;

        return yield* members.list(user, query.organization_id);
      }),
    )
    .handle("update", ({ params, query }) =>
      Effect.gen(function* () {
        const members = yield* MembersService;
        const user = yield* CurrentUser;

        return yield* members.transferOwnership(user, query.organization_id, params.user_id);
      }),
    )
    .handle("remove", ({ params, query }) =>
      Effect.gen(function* () {
        const members = yield* MembersService;
        const user = yield* CurrentUser;

        return yield* members.remove(user, query.organization_id, params.user_id);
      }),
    ),
);
