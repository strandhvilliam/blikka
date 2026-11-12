import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "../auth/Authenticated.ts";
import { Permission, PermissionDenied, Role } from "../permissions/permissions.ts";
import { Organization, OrganizationName, OrganizationNotFound } from "./schemas.ts";

export class OrganizationsApi extends HttpApiGroup.make("organizations")
  .add(
    HttpApiEndpoint.get("list", "/organizations", {
      success: Schema.Array(Schema.Struct({ ...Organization.fields, role: Role })),
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/organizations", {
      payload: Schema.Struct({ name: OrganizationName }),
      success: HttpApiSchema.status(201)(Organization),
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/organizations/:id", {
      // A malformed id is a 400 here rather than a Postgres error (500).
      params: { id: Schema.String.check(Schema.isUUID()) },
      success: Schema.Struct({ ...Organization.fields, permissions: Schema.Array(Permission) }),
      error: [HttpApiError.BadRequestNoContent, OrganizationNotFound, PermissionDenied],
    }),
  )
  .middleware(Authenticated) {}
