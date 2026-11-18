import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "../auth/Authenticated.ts";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import { TopicNotFound } from "../topics/schemas.ts";
import {
  Result,
  Round,
  RoundCreate,
  RoundEntriesInvalid,
  RoundHasNoEntries,
  RoundNotFound,
  RoundOpen,
  RoundStarted,
  RoundUpdate,
  RoundWindowInvalid,
  SourceRoundNotClosed,
} from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class RoundsApi extends HttpApiGroup.make("rounds")
  .add(
    HttpApiEndpoint.get("list", "/rounds", {
      query: { competition_id: Schema.optionalKey(Id) },
      success: Schema.Array(Round),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/rounds", {
      payload: RoundCreate,
      success: HttpApiSchema.status(201)(Round),
      error: [
        CompetitionNotFound,
        PermissionDenied,
        TopicNotFound,
        RoundNotFound,
        SourceRoundNotClosed,
        RoundEntriesInvalid,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/rounds/:id", {
      params: { id: Id },
      success: Round,
      error: [HttpApiError.BadRequestNoContent, RoundNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/rounds/:id", {
      params: { id: Id },
      payload: RoundUpdate,
      success: Round,
      error: [HttpApiError.BadRequestNoContent, RoundNotFound, PermissionDenied, RoundWindowInvalid],
    }),
  )
  .add(
    HttpApiEndpoint.post("open", "/rounds/:id/open", {
      params: { id: Id },
      payload: RoundOpen,
      success: Round,
      error: [
        HttpApiError.BadRequestNoContent,
        RoundNotFound,
        PermissionDenied,
        RoundStarted,
        RoundHasNoEntries,
        RoundWindowInvalid,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.delete("remove", "/rounds/:id", {
      params: { id: Id },
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.BadRequestNoContent, RoundNotFound, PermissionDenied],
    }),
  )
  .add(
    HttpApiEndpoint.get("results", "/rounds/:id/results", {
      params: { id: Id },
      success: Schema.Array(Result),
      error: [HttpApiError.BadRequestNoContent, RoundNotFound],
    }),
  )
  .middleware(Authenticated) {}
