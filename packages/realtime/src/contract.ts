import { Schema } from "effect"

export const REALTIME_CHANNEL_ENV = {
  PROD: "prod",
  DEV: "dev",
  STAGING: "staging",
} as const

export type RealtimeChannelEnv =
  (typeof REALTIME_CHANNEL_ENV)[keyof typeof REALTIME_CHANNEL_ENV]

export const realtimeChannelEnvironments = Object.values(
  REALTIME_CHANNEL_ENV,
) as [RealtimeChannelEnv, ...RealtimeChannelEnv[]]

export const RealtimeChannelEnvSchema = Schema.Literals(realtimeChannelEnvironments)

export const REALTIME_RESULT_OUTCOME = {
  SUCCESS: "success",
  ERROR: "error",
} as const

export type RealtimeResultOutcome =
  (typeof REALTIME_RESULT_OUTCOME)[keyof typeof REALTIME_RESULT_OUTCOME]

export const realtimeResultOutcomes = Object.values(
  REALTIME_RESULT_OUTCOME,
) as [RealtimeResultOutcome, ...RealtimeResultOutcome[]]

export const RealtimeResultOutcomeSchema = Schema.Literals(realtimeResultOutcomes)

export function getRealtimeChannelEnvironmentFromNodeEnv(
  nodeEnv: string | undefined,
): Extract<RealtimeChannelEnv, "prod" | "dev"> {
  return nodeEnv === "production"
    ? REALTIME_CHANNEL_ENV.PROD
    : REALTIME_CHANNEL_ENV.DEV
}

export function getDomainRealtimeChannel(
  environment: RealtimeChannelEnv,
  domain: string,
): string {
  return `${environment}:${domain}`
}

export function getParticipantRealtimeChannel(
  environment: RealtimeChannelEnv,
  domain: string,
  reference: string,
): string {
  return `${environment}:${domain}:${reference}`
}

export const REALTIME_EVENT_CHANNELS = {
  DOMAIN: "domain",
  PARTICIPANT: "participant",
  BOTH: "both",
} as const

export const REALTIME_EVENT_KEY = {
  UPLOAD_FLOW_INITIALIZED: "upload-flow-initialized",
  SUBMISSION_PROCESSED: "submission-processed",
  PARTICIPANT_FINALIZED: "participant-finalized",
  CONTACT_SHEET_GENERATED: "contact-sheet-generated",
  ZIP_GENERATED: "zip-generated",
  PARTICIPANT_VALIDATED: "participant-validated",
  PARTICIPANT_VERIFIED: "participant-verified",
  DEV_CALLER_COMPLETED: "dev-caller-completed",
} as const

export type RealtimeEventKey =
  (typeof REALTIME_EVENT_KEY)[keyof typeof REALTIME_EVENT_KEY]

export const realtimeEventKeys = Object.values(REALTIME_EVENT_KEY) as [
  RealtimeEventKey,
  ...RealtimeEventKey[],
]

export const RealtimeEventKeySchema = Schema.Literals(realtimeEventKeys)

export const REALTIME_EVENT_NAME = {
  EVENT_RESULT: "event.result",
} as const

export type RealtimeBaseEventName =
  (typeof REALTIME_EVENT_NAME)[keyof typeof REALTIME_EVENT_NAME]

export type RealtimeResultEventName = `event.result.${RealtimeEventKey}`

export function getRealtimeResultEventName<const TEventKey extends RealtimeEventKey>(
  eventKey: TEventKey,
): `event.result.${TEventKey}` {
  return `event.result.${eventKey}`
}

const realtimeEventResultPayloadFields = {
  eventKey: RealtimeEventKeySchema,
  domain: Schema.String,
  reference: Schema.NullOr(Schema.String),
  orderIndex: Schema.NullOr(Schema.Number),
  timestamp: Schema.Number,
  duration: Schema.NullOr(Schema.Number),
} as const

export const RealtimeEventSuccessPayloadSchema = Schema.Struct({
  ...realtimeEventResultPayloadFields,
  outcome: Schema.Literal(REALTIME_RESULT_OUTCOME.SUCCESS),
})

export const RealtimeEventErrorPayloadSchema = Schema.Struct({
  ...realtimeEventResultPayloadFields,
  outcome: Schema.Literal(REALTIME_RESULT_OUTCOME.ERROR),
  error: Schema.String,
})

export const RealtimeEventResultPayloadSchema = Schema.Union(
  [RealtimeEventSuccessPayloadSchema, RealtimeEventErrorPayloadSchema],
)

export type RealtimeEventResultPayload = Schema.Schema.Type<
  typeof RealtimeEventResultPayloadSchema
>
