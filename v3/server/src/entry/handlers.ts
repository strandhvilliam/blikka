import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { EntryCaller } from "../auth/EntrySession.ts";
import { CompetitionsService } from "../competitions/service.ts";
import { Api } from "../contract.ts";
import { ParticipantsService } from "../participants/service.ts";

// The services are built per request (api.ts), so they're read inside each handler.
export const EntryHandlers = HttpApiBuilder.group(Api, "entry", (handlers) =>
  handlers
    .handle("competition", ({ params }) =>
      Effect.gen(function* () {
        const competitions = yield* CompetitionsService;
        return yield* competitions.getPublished(params.slug);
      }),
    )
    .handle("enter", ({ payload }) =>
      Effect.gen(function* () {
        const participants = yield* ParticipantsService;
        const caller = yield* EntryCaller;
        return yield* participants.enter(caller.user, payload.competition_id, payload);
      }),
    )
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const participants = yield* ParticipantsService;
        return yield* participants.listOwn(yield* EntryCaller, query.competition_id);
      }),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const participants = yield* ParticipantsService;
        return yield* participants.requireParticipantOwner(yield* EntryCaller, params.id);
      }),
    ),
);
