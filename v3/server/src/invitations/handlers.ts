import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { CurrentUser } from "../auth/CurrentUser.ts";
import { Api } from "../contract.ts";
import { InvitationsService } from "./service.ts";

export const InvitationsHandlers = HttpApiBuilder.group(Api, "invitations", (handlers) =>
  handlers
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const invitations = yield* InvitationsService;
        const user = yield* CurrentUser;
        return yield* invitations.create(user, payload.organization_id, payload.email);
      }),
    )
    .handle("received", () =>
      Effect.gen(function* () {
        const invitations = yield* InvitationsService;
        const user = yield* CurrentUser;
        return yield* invitations.received(user);
      }),
    )
    .handle("accept", ({ params }) =>
      Effect.gen(function* () {
        const invitations = yield* InvitationsService;
        const user = yield* CurrentUser;
        return yield* invitations.accept(user, params.id);
      }),
    ),
);
