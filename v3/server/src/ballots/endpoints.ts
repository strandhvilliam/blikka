import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { BallotSession } from "../auth/BallotSession.ts";
import {
  Ballot,
  BallotDetail,
  BallotNotFound,
  BallotSubmitted,
  EntryNotFound,
  RoundNotOpen,
  Vote,
  VoteInput,
  VoteInvalid,
  VoteLimitReached,
} from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class BallotsApi extends HttpApiGroup.make("ballots")
  .add(
    HttpApiEndpoint.get("list", "/ballots", {
      query: { competition_id: Schema.optionalKey(Id) },
      success: Schema.Array(Ballot),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/ballots/:id", {
      params: { id: Id },
      success: BallotDetail,
      error: [HttpApiError.BadRequestNoContent, BallotNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.put("vote", "/ballots/:id/votes/:submission_id", {
      params: { id: Id, submission_id: Id },
      payload: VoteInput,
      success: Vote,
      error: [
        HttpApiError.BadRequestNoContent,
        BallotNotFound,
        RoundNotOpen,
        BallotSubmitted,
        EntryNotFound,
        VoteLimitReached,
        VoteInvalid,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.delete("unvote", "/ballots/:id/votes/:submission_id", {
      params: { id: Id, submission_id: Id },
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.BadRequestNoContent, BallotNotFound, RoundNotOpen, BallotSubmitted],
    }),
  )
  .add(
    HttpApiEndpoint.post("submit", "/ballots/:id/submit", {
      params: { id: Id },
      success: Ballot,
      error: [HttpApiError.BadRequestNoContent, BallotNotFound, RoundNotOpen, BallotSubmitted],
    }),
  )
  .middleware(BallotSession) {}
