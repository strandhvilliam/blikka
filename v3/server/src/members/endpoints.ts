import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "../auth/Authenticated.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import { Member, MemberNotFound, OwnerCannotBeRemoved } from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class MembersApi extends HttpApiGroup.make("members")
  .add(
    HttpApiEndpoint.get("list", "/members", {
      query: { organization_id: Schema.optionalKey(Id) },
      success: Schema.Array(Member),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/members/:user_id", {
      params: { user_id: Id },
      query: { organization_id: Id },
      payload: Schema.Struct({ role: Schema.Literal("owner") }),
      success: Member,
      error: [HttpApiError.BadRequestNoContent, MemberNotFound, PermissionDenied],
    }),
  )
  .add(
    HttpApiEndpoint.delete("remove", "/members/:user_id", {
      params: { user_id: Id },
      query: { organization_id: Id },
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.BadRequestNoContent, MemberNotFound, PermissionDenied, OwnerCannotBeRemoved],
    }),
  )
  .middleware(Authenticated) {}
