import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { EntryCaller } from "../auth/EntrySession.ts";
import { Api } from "../contract.ts";
import { EntryService } from "./service.ts";

// The services are built per request (api.ts), so they're read inside each handler.
export const EntryHandlers = HttpApiBuilder.group(Api, "entry", (handlers) =>
  handlers
    .handle("competition", ({ params }) =>
      Effect.gen(function* () {
        const entry = yield* EntryService;
        return yield* entry.getPublished(params.slug);
      }),
    )
    .handle("enter", ({ payload }) =>
      Effect.gen(function* () {
        const entry = yield* EntryService;
        const caller = yield* EntryCaller;
        return yield* entry.enter(caller.user, payload.competition_id, payload);
      }),
    )
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const entry = yield* EntryService;
        const caller = yield* EntryCaller;
        return yield* entry.listOwn(caller, query.competition_id);
      }),
    )
    .handle("get", ({ params }) =>
      Effect.gen(function* () {
        const entry = yield* EntryService;
        const caller = yield* EntryCaller;
        return yield* entry.requireParticipantOwner(caller, params.id);
      }),
    ),
);
