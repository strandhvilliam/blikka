import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import { Authenticated } from "../auth/Authenticated.ts";
import { Submission } from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

// The organizer's routes (adr/0006). Participants submit under /entry (adr/0004).
export class SubmissionsApi extends HttpApiGroup.make("submissions")
  .add(
    // Only ever submissions of entries the caller can read; participant_id narrows that.
    HttpApiEndpoint.get("list", "/submissions", {
      query: { participant_id: Schema.optionalKey(Id) },
      success: Schema.Array(Submission),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .middleware(Authenticated) {}
