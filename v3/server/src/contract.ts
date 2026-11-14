import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import { Authenticated } from "./auth/Authenticated.ts";
import { CompetitionsApi } from "./competitions/endpoints.ts";
import { InvitationsApi } from "./invitations/endpoints.ts";
import { MembersApi } from "./members/endpoints.ts";
import { OrganizationsApi } from "./organizations/endpoints.ts";

// Schemas only, so clients can import it without pulling in the database, Better Auth or secrets.
// A group's `.middleware(Authenticated)` covers only the endpoints added before it.

// Encoding drops every field not listed here, so the Api only ever sends these.
export const User = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
});
export type User = typeof User.Type;

export class UsersApi extends HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("me", "/me", { success: Schema.Struct({ user: User }) }))
  .middleware(Authenticated) {}

export class Api extends HttpApi.make("blikka")
  .add(UsersApi)
  .add(OrganizationsApi)
  .add(CompetitionsApi)
  .add(InvitationsApi)
  .add(MembersApi) {}
