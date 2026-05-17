import { Schema } from "effect";

export const GetSeedScenarioStatusInputSchema = Schema.Struct({
  domain: Schema.String,
});

export const SeedFinishedScenarioInputSchema = Schema.Struct({
  domain: Schema.String,
});

const PreviewSchema = Schema.Struct({
  participants: Schema.Number,
  topics: Schema.Number,
  competitionClasses: Schema.Number,
  deviceGroups: Schema.Number,
});

export const SeedScenarioStatusSchema = Schema.Struct({
  environment: Schema.String,
  mode: Schema.String,
  isAdminForDomain: Schema.Boolean,
  staffCount: Schema.Number,
  blockers: Schema.Array(Schema.String),
  canRun: Schema.Boolean,
  preview: PreviewSchema,
});

export const SeedScenarioResultSchema = Schema.Struct({
  mode: Schema.String,
  participantsCreated: Schema.Number,
  submissionsCreated: Schema.Number,
  participantVerificationsCreated: Schema.Number,
  validationResultsCreated: Schema.Number,
  juryInvitationsCreated: Schema.Number,
  juryRatingsCreated: Schema.Number,
  votingSessionsCreated: Schema.Number,
  votesCast: Schema.Number,
  contactSheetsCreated: Schema.Number,
});

export type GetSeedScenarioStatusInput = Schema.Schema.Type<
  typeof GetSeedScenarioStatusInputSchema
>;
export type SeedFinishedScenarioInput = Schema.Schema.Type<
  typeof SeedFinishedScenarioInputSchema
>;
export type SeedScenarioStatus = Schema.Schema.Type<
  typeof SeedScenarioStatusSchema
>;
export type SeedScenarioResult = Schema.Schema.Type<
  typeof SeedScenarioResultSchema
>;
