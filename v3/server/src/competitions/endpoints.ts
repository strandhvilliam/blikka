import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "../auth/Authenticated.ts";
import { OrganizationNotFound } from "../organizations/schemas.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import {
  Competition,
  CompetitionCreate,
  CompetitionHasNoTopics,
  CompetitionHasParticipants,
  CompetitionNameTaken,
  CompetitionNotFound,
  CompetitionUpdate,
  CompetitionWindowInvalid,
} from "./schemas.ts";

// A malformed id is a 400 here rather than a Postgres error (500).
const Id = Schema.String.check(Schema.isUUID());

export class CompetitionsApi extends HttpApiGroup.make("competitions")
  .add(
    // Only ever the caller's competitions; organization_id narrows that, and someone else's gives [].
    HttpApiEndpoint.get("list", "/competitions", {
      query: { organization_id: Schema.optionalKey(Id) },
      success: Schema.Array(Competition),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/competitions", {
      payload: CompetitionCreate,
      success: HttpApiSchema.status(201)(Competition),
      error: [OrganizationNotFound, PermissionDenied, CompetitionNameTaken, CompetitionWindowInvalid],
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/competitions/:id", {
      params: { id: Id },
      success: Competition,
      error: [HttpApiError.BadRequestNoContent, CompetitionNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/competitions/:id", {
      params: { id: Id },
      payload: CompetitionUpdate,
      success: Competition,
      error: [
        HttpApiError.BadRequestNoContent,
        CompetitionNotFound,
        PermissionDenied,
        CompetitionWindowInvalid,
        CompetitionHasNoTopics,
        CompetitionHasParticipants,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.delete("remove", "/competitions/:id", {
      params: { id: Id },
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.BadRequestNoContent, CompetitionNotFound, PermissionDenied],
    }),
  )
  .middleware(Authenticated) {}
