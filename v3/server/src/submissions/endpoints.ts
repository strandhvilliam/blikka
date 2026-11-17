import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import { Authenticated } from "../auth/Authenticated.ts";
import { Submission } from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class SubmissionsApi extends HttpApiGroup.make("submissions")
  .add(
    HttpApiEndpoint.get("list", "/submissions", {
      query: { participant_id: Schema.optionalKey(Id) },
      success: Schema.Array(Submission),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .middleware(Authenticated) {}
