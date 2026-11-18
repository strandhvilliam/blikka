import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { RoundsService } from "./service.ts";

export const RoundsHandlers = HttpApiBuilder.group(Api, "rounds", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const rounds = yield* RoundsService;
        const user = yield* CurrentUser;

        return yield* rounds.list(user, query.competition_id);
      }),
    )
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const rounds = yield* RoundsService;
        const user = yield* CurrentUser;

        return yield* rounds.create(user, payload);
      }),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const rounds = yield* RoundsService;
        const user = yield* CurrentUser;

        return yield* rounds.get(user, params.id);
      }),
    )
    .handle("update", ({ params, payload }) =>
      Effect.gen(function* () {
        const rounds = yield* RoundsService;
        const user = yield* CurrentUser;

        return yield* rounds.update(user, params.id, payload);
      }),
    )
    .handle("open", ({ params, payload }) =>
      Effect.gen(function* () {
        const rounds = yield* RoundsService;
        const user = yield* CurrentUser;

        return yield* rounds.open(user, params.id, payload.closes_at ?? null);
      }),
    )
    .handle("remove", ({ params }) =>
      Effect.gen(function* () {
        const rounds = yield* RoundsService;
        const user = yield* CurrentUser;

        return yield* rounds.remove(user, params.id);
      }),
    )
    .handle("results", ({ params }) =>
      Effect.gen(function* () {
        const rounds = yield* RoundsService;
        const user = yield* CurrentUser;

        return yield* rounds.results(user, params.id);
      }),
    ),
);
