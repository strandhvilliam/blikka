import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { ParticipantsService } from "./service.ts";

export const ParticipantsHandlers = HttpApiBuilder.group(Api, "participants", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const participants = yield* ParticipantsService;
        const user = yield* CurrentUser;

        return yield* participants.list(user, query.competition_id);
      }),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const participants = yield* ParticipantsService;
        const user = yield* CurrentUser;

        return yield* participants.get(user, params.id);
      }),
    )
    .handle("remove", ({ params }) =>
      Effect.gen(function* () {
        const participants = yield* ParticipantsService;
        const user = yield* CurrentUser;

        return yield* participants.remove(user, params.id);
      }),
    ),
);
