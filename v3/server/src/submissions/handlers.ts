import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { SubmissionsService } from "./service.ts";

export const SubmissionsHandlers = HttpApiBuilder.group(Api, "submissions", (handlers) =>
  handlers.handle("list", ({ query }) =>
    Effect.gen(function* () {
      const submissions = yield* SubmissionsService;
      const user = yield* CurrentUser;

      return yield* submissions.list(user, query.participant_id);
    }),
  ),
);
