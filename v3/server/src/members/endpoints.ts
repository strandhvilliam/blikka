import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import { Authenticated } from "../auth/Authenticated.ts";
import { Member } from "./schemas.ts";

export class MembersApi extends HttpApiGroup.make("members")
  .add(
    HttpApiEndpoint.get("list", "/members", {
      query: { organization_id: Schema.optionalKey(Schema.String.check(Schema.isUUID())) },
      success: Schema.Array(Member),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .middleware(Authenticated) {}
