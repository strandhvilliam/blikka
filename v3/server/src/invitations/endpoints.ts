import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "../auth/Authenticated.ts";
import { OrganizationNotFound } from "../organizations/schemas.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import { AlreadyMember, Invitation, InvitationEmail, InvitationNotFound, ReceivedInvitation } from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class InvitationsApi extends HttpApiGroup.make("invitations")
  .add(
    HttpApiEndpoint.post("create", "/invitations", {
      payload: Schema.Struct({ organization_id: Id, email: InvitationEmail }),
      success: HttpApiSchema.status(201)(Invitation),
      error: [OrganizationNotFound, PermissionDenied, AlreadyMember],
    }),
  )
  .add(
    HttpApiEndpoint.get("received", "/invitations/received", {
      success: Schema.Array(ReceivedInvitation),
    }),
  )
  .add(
    HttpApiEndpoint.post("accept", "/invitations/:id/accept", {
      params: { id: Id },
      success: Schema.Struct({ organization_id: Schema.String }),
      error: [HttpApiError.BadRequestNoContent, InvitationNotFound],
    }),
  )
  .middleware(Authenticated) {}
