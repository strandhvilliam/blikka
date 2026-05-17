import { Schema } from "effect"

export const GetByDomainInputSchema = Schema.Struct({ domain: Schema.String });

export const UpdateMarathonInputSchema = Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.optional(Schema.String),
      description: Schema.optional(Schema.String),
      startDate: Schema.optional(Schema.String),
      endDate: Schema.optional(Schema.String),
      logoUrl: Schema.optional(Schema.String),
      languages: Schema.optional(Schema.String),
      termsAndConditionsKey: Schema.optional(Schema.String),
    }),
  });

export const ResetMarathonInputSchema = Schema.Struct({
    domain: Schema.String,
  });

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

export const GetLogoUploadUrlInputSchema = Schema.Struct({
    domain: Schema.String,
    currentKey: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  });

export const GetTermsUploadUrlInputSchema = Schema.Struct({
    domain: Schema.String,
  });

export const GetCurrentTermsInputSchema = Schema.Struct({
    domain: Schema.String,
  });

export type GetByDomainInput = Schema.Schema.Type<typeof GetByDomainInputSchema>
export type UpdateMarathonInput = Schema.Schema.Type<typeof UpdateMarathonInputSchema>
export type ResetMarathonInput = Schema.Schema.Type<typeof ResetMarathonInputSchema>
export type GetSeedScenarioStatusInput = Schema.Schema.Type<typeof GetSeedScenarioStatusInputSchema>
export type SeedFinishedScenarioInput = Schema.Schema.Type<typeof SeedFinishedScenarioInputSchema>
export type SeedScenarioStatus = Schema.Schema.Type<typeof SeedScenarioStatusSchema>
export type SeedScenarioResult = Schema.Schema.Type<typeof SeedScenarioResultSchema>
export type GetLogoUploadUrlInput = Schema.Schema.Type<typeof GetLogoUploadUrlInputSchema>
export type GetTermsUploadUrlInput = Schema.Schema.Type<typeof GetTermsUploadUrlInputSchema>
export type GetCurrentTermsInput = Schema.Schema.Type<typeof GetCurrentTermsInputSchema>
