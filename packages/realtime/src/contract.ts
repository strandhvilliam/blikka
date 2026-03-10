import { Schema } from "effect";

const realtimeChannelEnvironments = ["prod", "dev", "staging"] as const;

export type RealtimeChannelEnv = (typeof realtimeChannelEnvironments)[number];

export const RealtimeChannelEnvSchema = Schema.Literals(
  realtimeChannelEnvironments,
);

export const realtimeResultOutcomes = ["success", "error"] as const;

export type RealtimeResultOutcome = (typeof realtimeResultOutcomes)[number];

export function getRealtimeChannelEnvironmentFromNodeEnv(
  nodeEnv: string | undefined,
): Extract<RealtimeChannelEnv, "prod" | "dev"> {
  return nodeEnv === "production" ? "prod" : "dev";
}

export function getDomainRealtimeChannel(
  environment: RealtimeChannelEnv,
  domain: string,
): string {
  return `${environment}:${domain}`;
}

export function getParticipantRealtimeChannel(
  environment: RealtimeChannelEnv,
  domain: string,
  reference: string,
): string {
  return `${environment}:${domain}:${reference}`;
}

export type RealtimeEventChannels = "domain" | "participant" | "both";

export const realtimeEventKeys = [
  "upload-flow-initialized",
  "participant-prepared",
  "submission-processed",
  "participant-finalized",
  "contact-sheet-generated",
  "zip-generated",
  "participant-validated",
  "participant-verified",
  "dev-caller-completed",
] as const;

export type RealtimeEventKey = (typeof realtimeEventKeys)[number];

const RealtimeEventKeySchema = Schema.Literals(realtimeEventKeys);

export function getRealtimeResultEventName<
  const TEventKey extends RealtimeEventKey,
>(eventKey: TEventKey): `event.result.${TEventKey}` {
  return `event.result.${eventKey}`;
}

const realtimeEventResultPayloadFields = {
  eventKey: RealtimeEventKeySchema,
  domain: Schema.String,
  reference: Schema.NullOr(Schema.String),
  orderIndex: Schema.NullOr(Schema.Number),
  timestamp: Schema.Number,
  duration: Schema.NullOr(Schema.Number),
} as const;

export const RealtimeEventSuccessPayloadSchema = Schema.Struct({
  ...realtimeEventResultPayloadFields,
  outcome: Schema.Literal("success"),
});

export const RealtimeEventErrorPayloadSchema = Schema.Struct({
  ...realtimeEventResultPayloadFields,
  outcome: Schema.Literal("error"),
  error: Schema.String,
});

export const RealtimeEventResultPayloadSchema = Schema.Union([
  RealtimeEventSuccessPayloadSchema,
  RealtimeEventErrorPayloadSchema,
]);

export type RealtimeEventResultPayload = Schema.Schema.Type<
  typeof RealtimeEventResultPayloadSchema
>;
