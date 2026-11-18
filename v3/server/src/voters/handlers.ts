import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { VotersService } from "./service.ts";

export const VotersHandlers = HttpApiBuilder.group(Api, "voters", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const voters = yield* VotersService;
        const user = yield* CurrentUser;

        return yield* voters.list(user, query.round_id);
      }),
    )
    .handle("invite", ({ payload }) =>
      Effect.gen(function* () {
        const voters = yield* VotersService;
        const user = yield* CurrentUser;

        return yield* voters.invite(user, payload);
      }),
    )
    .handle("renewToken", ({ params }) =>
      Effect.gen(function* () {
        const voters = yield* VotersService;
        const user = yield* CurrentUser;

        return yield* voters.renewToken(user, params.id);
      }),
    )
    .handle("revoke", ({ params }) =>
      Effect.gen(function* () {
        const voters = yield* VotersService;
        const user = yield* CurrentUser;

        return yield* voters.revoke(user, params.id);
      }),
    ),
);
