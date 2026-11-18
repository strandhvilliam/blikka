import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "../auth/Authenticated.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import { RoundNotFound } from "../rounds/schemas.ts";
import { NotJuryRound, Voter, VoterAlreadyInvited, VoterCreate, VoterNotFound, VoterWithToken } from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class VotersApi extends HttpApiGroup.make("voters")
  .add(
    HttpApiEndpoint.get("list", "/voters", {
      query: { round_id: Schema.optionalKey(Id) },
      success: Schema.Array(Voter),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .add(
    HttpApiEndpoint.post("invite", "/voters", {
      payload: VoterCreate,
      success: HttpApiSchema.status(201)(VoterWithToken),
      error: [RoundNotFound, PermissionDenied, NotJuryRound, VoterAlreadyInvited],
    }),
  )
  .add(
    HttpApiEndpoint.post("renewToken", "/voters/:id/token", {
      params: { id: Id },
      success: VoterWithToken,
      error: [HttpApiError.BadRequestNoContent, VoterNotFound, PermissionDenied],
    }),
  )
  .add(
    HttpApiEndpoint.delete("revoke", "/voters/:id", {
      params: { id: Id },
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.BadRequestNoContent, VoterNotFound, PermissionDenied],
    }),
  )
  .middleware(Authenticated) {}
