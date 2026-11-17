import * as Schema from "effect/Schema";

export const Competition = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  description: Schema.String,
  time_zone: Schema.String,
  published_at: Schema.NullOr(Schema.Date),
  opens_at: Schema.NullOr(Schema.Date),
  closes_at: Schema.NullOr(Schema.Date),
  topics_in_sequence: Schema.Boolean,
  minutes_per_topic: Schema.NullOr(Schema.Int),
});

export type Competition = typeof Competition.Type;

export const CompetitionName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100));

export const CompetitionDescription = Schema.Trim.check(Schema.isMaxLength(2000));

export const TimeZone = Schema.String.check(
  Schema.makeFilter((timeZone: string) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone });

      return true;
    } catch {
      return "not an IANA time zone";
    }
  }),
);

export const MinutesPerTopic = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(1440));

export const CompetitionCreate = Schema.Struct({
  organization_id: Schema.String.check(Schema.isUUID()),
  name: CompetitionName,
  time_zone: TimeZone,
});

export type CompetitionCreate = typeof CompetitionCreate.Type;

export const CompetitionUpdate = Schema.Struct({
  name: Schema.optionalKey(CompetitionName),
  description: Schema.optionalKey(CompetitionDescription),
  time_zone: Schema.optionalKey(TimeZone),
  opens_at: Schema.optionalKey(Schema.NullOr(Schema.Date)),
  closes_at: Schema.optionalKey(Schema.NullOr(Schema.Date)),
  topics_in_sequence: Schema.optionalKey(Schema.Boolean),
  minutes_per_topic: Schema.optionalKey(Schema.NullOr(MinutesPerTopic)),
  published: Schema.optionalKey(Schema.Boolean),
});

export type CompetitionUpdate = typeof CompetitionUpdate.Type;

export class CompetitionHasNoTopics extends Schema.TaggedError<CompetitionHasNoTopics>()(
  "CompetitionHasNoTopics",
  {},
  { httpApiStatus: 409 },
) {}

export class CompetitionHasParticipants extends Schema.TaggedError<CompetitionHasParticipants>()(
  "CompetitionHasParticipants",
  {},
  { httpApiStatus: 409 },
) {}

export class CompetitionWindowInvalid extends Schema.TaggedError<CompetitionWindowInvalid>()(
  "CompetitionWindowInvalid",
  {},
  { httpApiStatus: 400 },
) {}

export class TimeLimitNeedsSequence extends Schema.TaggedError<TimeLimitNeedsSequence>()(
  "TimeLimitNeedsSequence",
  {},
  { httpApiStatus: 400 },
) {}

export const slugOf = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "") || "event";

export class CompetitionNameTaken extends Schema.TaggedError<CompetitionNameTaken>()(
  "CompetitionNameTaken",
  {},
  { httpApiStatus: 409 },
) {}

export class CompetitionNotFound extends Schema.TaggedError<CompetitionNotFound>()(
  "CompetitionNotFound",
  {},
  { httpApiStatus: 404 },
) {}
