import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import { Authenticated } from "../auth/Authenticated.ts";
import { Participant } from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

// The organizer's routes (adr/0006). Participants have their own, under /entry (adr/0004).
export class ParticipantsApi extends HttpApiGroup.make("participants")
  .add(
    // Only ever entries in the caller's competitions; competition_id narrows that.
    HttpApiEndpoint.get("list", "/participants", {
      query: { competition_id: Schema.optionalKey(Id) },
      success: Schema.Array(Participant),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .middleware(Authenticated) {}
