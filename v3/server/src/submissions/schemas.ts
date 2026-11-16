import * as Schema from "effect/Schema";

// The organizer's view of a delivered topic. Participants see theirs as EntrySubmission.
export const Submission = Schema.Struct({
  id: Schema.String,
  participant_id: Schema.String,
  topic_id: Schema.String,
  created_at: Schema.Date,
  updated_at: Schema.Date,
});

export type Submission = typeof Submission.Type;
