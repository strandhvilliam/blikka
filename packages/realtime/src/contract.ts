import { Schema } from "effect"

export const realtimeChannelEnvironments = ["prod", "dev", "staging"] as const

export type RealtimeChannelEnv = (typeof realtimeChannelEnvironments)[number]

export const RealtimeChannelEnvSchema = Schema.Literals(realtimeChannelEnvironments)

export const realtimeResultOutcomes = ["success", "error"] as const

export type RealtimeResultOutcome = (typeof realtimeResultOutcomes)[number]

export const RealtimeResultOutcomeSchema = Schema.Literals(realtimeResultOutcomes)

export function getRealtimeChannelEnvironmentFromNodeEnv(
  nodeEnv: string | undefined,
): Extract<RealtimeChannelEnv, "prod" | "dev"> {
  return nodeEnv === "production"
    ? "prod"
    : "dev"
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

export const realtimeEventChannels = ["domain", "participant", "both"] as const

export type RealtimeEventChannels = (typeof realtimeEventChannels)[number]

export const realtimeEventKeys = [
  "upload-flow-initialized",
  "submission-processed",
  "participant-finalized",
  "contact-sheet-generated",
  "zip-generated",
  "participant-validated",
  "participant-verified",
  "dev-caller-completed",
] as const

export type RealtimeEventKey = (typeof realtimeEventKeys)[number]

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
  outcome: Schema.Literal("success"),
})

export const RealtimeEventErrorPayloadSchema = Schema.Struct({
  ...realtimeEventResultPayloadFields,
  outcome: Schema.Literal("error"),
  error: Schema.String,
})

export const RealtimeEventResultPayloadSchema = Schema.Union(
  [RealtimeEventSuccessPayloadSchema, RealtimeEventErrorPayloadSchema],
)

export type RealtimeEventResultPayload = Schema.Schema.Type<
  typeof RealtimeEventResultPayloadSchema
>
