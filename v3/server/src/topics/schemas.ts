import * as Schema from "effect/Schema";

export const Topic = Schema.Struct({
  id: Schema.String,
  competition_id: Schema.String,
  name: Schema.String,
  position: Schema.Int,
  submissions: Schema.Int,
});

export type Topic = typeof Topic.Type;

export const TopicName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100));

export const TopicUpdate = Schema.Struct({
  name: Schema.optionalKey(TopicName),
  position: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
});

export type TopicUpdate = typeof TopicUpdate.Type;

export class TopicNotFound extends Schema.TaggedError<TopicNotFound>()("TopicNotFound", {}, { httpApiStatus: 404 }) {}

export class LastTopic extends Schema.TaggedError<LastTopic>()("LastTopic", {}, { httpApiStatus: 409 }) {}

export class TopicHasSubmissions extends Schema.TaggedError<TopicHasSubmissions>()(
  "TopicHasSubmissions",
  {},
  { httpApiStatus: 409 },
) {}

export class TopicOrderLocked extends Schema.TaggedError<TopicOrderLocked>()(
  "TopicOrderLocked",
  {},
  { httpApiStatus: 409 },
) {}
