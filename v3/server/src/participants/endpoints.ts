import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "../auth/Authenticated.ts";
import { ParticipantNotFound } from "../entry/schemas.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import { Participant } from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class ParticipantsApi extends HttpApiGroup.make("participants")
  .add(
    HttpApiEndpoint.get("list", "/participants", {
      query: { competition_id: Schema.optionalKey(Id) },
      success: Schema.Array(Participant),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/participants/:id", {
      params: { id: Id },
      success: Participant,
      error: [HttpApiError.BadRequestNoContent, ParticipantNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.delete("remove", "/participants/:id", {
      params: { id: Id },
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.BadRequestNoContent, ParticipantNotFound, PermissionDenied],
    }),
  )
  .middleware(Authenticated) {}
