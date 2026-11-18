import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { BallotCaller } from "../auth/BallotSession.ts";
import { Api } from "../contract.ts";
import { BallotsService } from "./service.ts";

export const BallotsHandlers = HttpApiBuilder.group(Api, "ballots", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const ballots = yield* BallotsService;
        const caller = yield* BallotCaller;

        return yield* ballots.list(caller, query.competition_id);
      }),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const ballots = yield* BallotsService;
        const caller = yield* BallotCaller;

        return yield* ballots.get(caller, params.id);
      }),
    )
    .handle("vote", ({ params, payload }) =>
      Effect.gen(function* () {
        const ballots = yield* BallotsService;
        const caller = yield* BallotCaller;

        return yield* ballots.vote(caller, params.id, params.submission_id, payload);
      }),
    )
    .handle("unvote", ({ params }) =>
      Effect.gen(function* () {
        const ballots = yield* BallotsService;
        const caller = yield* BallotCaller;

        return yield* ballots.unvote(caller, params.id, params.submission_id);
      }),
    )
    .handle("submit", ({ params }) =>
      Effect.gen(function* () {
        const ballots = yield* BallotsService;
        const caller = yield* BallotCaller;

        return yield* ballots.submit(caller, params.id);
      }),
    ),
);
