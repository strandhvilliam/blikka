import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "./auth/Authenticated.ts";

// The Api's contract (adr/0002-website-and-api-boundary.md): Schemas only, so any client can import
// it without pulling in the database, Better Auth or secrets. The Api implements it in api.ts.
// A group's `.middleware(Authenticated)` makes every endpoint added before it 401 when signed out.

// Encoding drops every field not listed here, so the Api only ever sends these.
export const User = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
});

export class UsersApi extends HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("me", "/me", { success: Schema.Struct({ user: User }) }))
  .middleware(Authenticated) {}

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

export class OrganizationsApi extends HttpApiGroup.make("organizations")
  .add(
    HttpApiEndpoint.post("create", "/organizations", {
      payload: Schema.Struct({ name: Schema.String }),
      success: HttpApiSchema.status(201)(Organization),
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/organizations/:id", {
      // A malformed id is a 400 here rather than a Postgres error (500).
      params: { id: Schema.String.check(Schema.isUUID()) },
      success: Organization,
      // NotFound also when the caller is not a member, so outsiders can't tell whether it exists.
      error: [HttpApiError.BadRequestNoContent, HttpApiError.NotFoundNoContent],
    }),
  )
  .middleware(Authenticated) {}

export class Api extends HttpApi.make("blikka").add(UsersApi).add(OrganizationsApi) {}
