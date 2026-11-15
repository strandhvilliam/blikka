import * as Schema from "effect/Schema";

export const Topic = Schema.Struct({
  id: Schema.String,
  competition_id: Schema.String,
  name: Schema.String,
  position: Schema.Int,
});

export type Topic = typeof Topic.Type;

export const TopicName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100));

// A position past the end moves the topic to the end.
export const TopicUpdate = Schema.Struct({
  name: Schema.optionalKey(TopicName),
  position: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
});

export type TopicUpdate = typeof TopicUpdate.Type;

// Also for topics of competitions the caller can't read.
export class TopicNotFound extends Schema.TaggedError<TopicNotFound>()("TopicNotFound", {}, { httpApiStatus: 404 }) {}

// A published competition needs at least one topic (adr/0009).
export class LastTopic extends Schema.TaggedError<LastTopic>()("LastTopic", {}, { httpApiStatus: 409 }) {}
