import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import { Authenticated } from "../auth/Authenticated.ts";
import { CompetitionNotFound } from "../competitions/schemas.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import {
  LastTopic,
  Topic,
  TopicHasSubmissions,
  TopicName,
  TopicNotFound,
  TopicOrderLocked,
  TopicUpdate,
} from "./schemas.ts";

const Id = Schema.String.check(Schema.isUUID());

export class TopicsApi extends HttpApiGroup.make("topics")
  .add(
    // In position order. Only ever topics of competitions the caller can read.
    HttpApiEndpoint.get("list", "/topics", {
      query: { competition_id: Schema.optionalKey(Id) },
      success: Schema.Array(Topic),
      error: HttpApiError.BadRequestNoContent,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/topics", {
      payload: Schema.Struct({ competition_id: Id, name: TopicName }),
      success: HttpApiSchema.status(201)(Topic),
      error: [CompetitionNotFound, PermissionDenied],
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/topics/:id", {
      params: { id: Id },
      payload: TopicUpdate,
      success: Topic,
      error: [HttpApiError.BadRequestNoContent, TopicNotFound, PermissionDenied, TopicOrderLocked],
    }),
  )
  .add(
    HttpApiEndpoint.delete("remove", "/topics/:id", {
      params: { id: Id },
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.BadRequestNoContent, TopicNotFound, PermissionDenied, LastTopic, TopicHasSubmissions],
    }),
  )
  .middleware(Authenticated) {}
