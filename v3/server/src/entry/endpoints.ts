import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { EntrySession } from "../auth/EntrySession.ts";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import { AlreadyEntered, EntryClosed, GuestDetailsRequired, ParticipantNotFound } from "../participants/schemas.ts";
import { EntryCompetition, EntryParticipant, ParticipantEmail, ParticipantName } from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

// What participants call, as guests or signed in (adr/0004): the organizer's flat routes under /entry,
// each answering only with the caller's own entries.
export class EntryApi extends HttpApiGroup.make("entry")
  .add(
    HttpApiEndpoint.get("competition", "/competitions/:slug", {
      params: { slug: Schema.String },
      success: EntryCompetition,
      error: CompetitionNotFound,
    }),
  )
  .add(
    // Signed in, name and email come from the account and anything sent is ignored.
    HttpApiEndpoint.post("enter", "/participants", {
      payload: Schema.Struct({
        competition_id: Id,
        name: Schema.optionalKey(ParticipantName),
        email: Schema.optionalKey(ParticipantEmail),
      }),
      success: HttpApiSchema.status(201)(
        Schema.Struct({ participant: EntryParticipant, guest_token: Schema.NullOr(Schema.String) }),
      ),
      error: [CompetitionNotFound, GuestDetailsRequired, EntryClosed, AlreadyEntered],
    }),
  )
  .add(
    HttpApiEndpoint.get("list", "/participants", {
      query: { competition_id: Schema.optionalKey(Id) },
      success: Schema.Array(EntryParticipant),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/participants/:id", {
      params: { id: Id },
      success: EntryParticipant,
      error: [HttpApiError.BadRequestNoContent, ParticipantNotFound],
    }),
  )
  .prefix("/entry")
  .middleware(EntrySession) {}
