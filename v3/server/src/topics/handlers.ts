import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { TopicsService } from "./service.ts";

export const TopicsHandlers = HttpApiBuilder.group(Api, "topics", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const topics = yield* TopicsService;
        const user = yield* CurrentUser;

        return yield* topics.list(user, query.competition_id);
      }),
    )
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const topics = yield* TopicsService;
        const user = yield* CurrentUser;

        return yield* topics.create(user, payload.competition_id, payload.name);
      }),
    )
    .handle("update", ({ params, payload }) =>
      Effect.gen(function* () {
        const topics = yield* TopicsService;
        const user = yield* CurrentUser;

        return yield* topics.update(user, params.id, payload);
      }),
    )
    .handle("remove", ({ params }) =>
      Effect.gen(function* () {
        const topics = yield* TopicsService;
        const user = yield* CurrentUser;

        return yield* topics.remove(user, params.id);
      }),
    ),
);
