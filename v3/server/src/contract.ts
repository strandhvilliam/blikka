import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

// The Api's contract (adr/0002-website-and-api-boundary.md): Schemas only, so any client can import
// it without pulling in the database, Better Auth or secrets. The Api implements it in api.ts.

// Encoding drops every field not listed here, so the Api only ever sends these.
export const User = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
});

export class UsersApi extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("me", "/me", {
    success: Schema.Struct({ user: User }),
    error: HttpApiError.UnauthorizedNoContent,
  }),
) {}

export class Api extends HttpApi.make("blikka").add(UsersApi) {}
