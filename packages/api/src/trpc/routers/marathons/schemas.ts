import { Schema } from "effect"

export class MarathonApiError extends Schema.TaggedErrorClass<MarathonApiError>()(
  "@blikka/api/marathon-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) { }

export const GetByDomainInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ domain: Schema.String })
)

export const UpdateMarathonInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
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
  })
)

export const ResetMarathonInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const GetSeedScenarioStatusInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

export const SeedFinishedScenarioInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)

const PreviewSchema = Schema.Struct({
  participants: Schema.Number,
  topics: Schema.Number,
  competitionClasses: Schema.Number,
  deviceGroups: Schema.Number,
})

export const SeedScenarioStatusSchema = Schema.Struct({
  environment: Schema.String,
  mode: Schema.String,
  isAdminForDomain: Schema.Boolean,
  staffCount: Schema.Number,
  blockers: Schema.Array(Schema.String),
  canRun: Schema.Boolean,
  preview: PreviewSchema,
})

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
})

export const GetLogoUploadUrlInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    currentKey: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  })
)

export const GetTermsUploadUrlInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)


export const GetCurrentTermsInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
  })
)
