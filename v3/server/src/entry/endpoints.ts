import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { EntrySession } from "../auth/EntrySession.ts";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import { TopicNotFound } from "../topics/schemas.ts";
import {
  AlreadyEntered,
  EntryClosed,
  EntryCompetition,
  EntryParticipant,
  EntrySubmission,
  EntryTopic,
  GuestDetailsRequired,
  ParticipantEmail,
  ParticipantName,
  ParticipantNotFound,
  TopicNotOpen,
} from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class EntryApi extends HttpApiGroup.make("entry")
  .add(
    HttpApiEndpoint.get("competition", "/competitions/:slug", {
      params: { slug: Schema.String },
      success: EntryCompetition,
      error: CompetitionNotFound,
    }),
  )
  .add(
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
  .add(
    HttpApiEndpoint.get("topics", "/topics", {
      query: { participant_id: Id },
      success: Schema.Array(EntryTopic),
      error: [HttpApiError.BadRequestNoContent, ParticipantNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post("submit", "/submissions", {
      payload: Schema.Struct({ participant_id: Id, topic_id: Id }),
      success: EntrySubmission,
      error: [ParticipantNotFound, TopicNotFound, TopicNotOpen],
    }),
  )
  .prefix("/entry")
  .middleware(EntrySession) {}
