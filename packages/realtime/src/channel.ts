import { Effect, Schema } from "effect"
import {
  RealtimeChannelEnvSchema,
  getDomainRealtimeChannel,
  getParticipantRealtimeChannel,
} from "./contract"
import type { RealtimeChannelEnv } from "./contract"

export class RealtimeError extends Schema.TaggedErrorClass<RealtimeError>()("RealtimeError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

/**
 * Two-tier channel model:
 *   domain-level:      {env}:{domain}
 *   participant-level:  {env}:{domain}:{reference}
 */
export class RealtimeChannel extends Schema.Class<RealtimeChannel>("RealtimeChannel")({
  environment: RealtimeChannelEnvSchema,
  domain: Schema.String,
  reference: Schema.optional(Schema.String),
}) {
  get channelString(): string {
    return this.reference
      ? getParticipantRealtimeChannel(this.environment, this.domain, this.reference)
      : getDomainRealtimeChannel(this.environment, this.domain)
  }

  static domain = Effect.fn("RealtimeChannel.domain")(function* (
    environment: RealtimeChannelEnv,
    domain: string,
  ) {
    return yield* Schema.decodeUnknownEffect(RealtimeChannel)({
      environment,
      domain,
    }).pipe(Effect.mapError((error) => new RealtimeError({ message: error.message, cause: error })))
  })

  static participant = Effect.fn("RealtimeChannel.participant")(function* (
    environment: RealtimeChannelEnv,
    domain: string,
    reference: string,
  ) {
    return yield* Schema.decodeUnknownEffect(RealtimeChannel)({
      environment,
      domain,
      reference,
    }).pipe(Effect.mapError((error) => new RealtimeError({ message: error.message, cause: error })))
  })
}
