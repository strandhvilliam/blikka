import { Effect, Schema } from "effect"


export class RealtimeError extends Schema.TaggedErrorClass<RealtimeError>()("RealtimeError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export const REALTIME_CHANNEL_ENV = {
  PROD: "prod",
  DEV: "dev",
  STAGING: "staging",
} as const


const RealtimeChannelEnv = Schema.Literals(Object.values(REALTIME_CHANNEL_ENV))
export type RealtimeChannelEnv = Schema.Schema.Type<typeof RealtimeChannelEnv>



export const REALTIME_EVENT_NAME = {
  TASK_START: "task.start",
  TASK_END: "task.end",
  TASK_ERROR: "task.error",
} as const
export const RealtimeEventName = Schema.String
export type RealtimeBaseEventName =
  (typeof REALTIME_EVENT_NAME)[keyof typeof REALTIME_EVENT_NAME]
export type RealtimeTaskScopedEventName =
  | `task.start.${string}`
  | `task.end.${string}`
  | `task.error.${string}`
export type RealtimeEventName = RealtimeTaskScopedEventName

export function getTaskScopedRealtimeEventNames<const TTaskName extends string>(taskName: TTaskName) {
  return {
    taskStart: `task.start.${taskName}` as `task.start.${TTaskName}`,
    taskEnd: `task.end.${taskName}` as `task.end.${TTaskName}`,
    taskError: `task.error.${taskName}` as `task.error.${TTaskName}`,
  }
}

export const TaskStartPayload = Schema.Struct({
  taskName: Schema.String,
  domain: Schema.String,
  reference: Schema.String,
  orderIndex: Schema.NullOr(Schema.Number),
  timestamp: Schema.Number,
})

export const TaskEndPayload = Schema.Struct({
  taskName: Schema.String,
  domain: Schema.String,
  reference: Schema.String,
  orderIndex: Schema.NullOr(Schema.Number),
  timestamp: Schema.Number,
  duration: Schema.Number,
})

export const TaskErrorPayload = Schema.Struct({
  taskName: Schema.String,
  domain: Schema.String,
  reference: Schema.String,
  orderIndex: Schema.NullOr(Schema.Number),
  timestamp: Schema.Number,
  duration: Schema.Number,
  error: Schema.String,
})

export type TaskStartPayload = Schema.Schema.Type<typeof TaskStartPayload>
export type TaskEndPayload = Schema.Schema.Type<typeof TaskEndPayload>
export type TaskErrorPayload = Schema.Schema.Type<typeof TaskErrorPayload>

/**
 * Two-tier channel model:
 *   domain-level:      {env}:{domain}
 *   participant-level:  {env}:{domain}:{reference}
 */
export class RealtimeChannel extends Schema.Class<RealtimeChannel>("RealtimeChannel")({
  environment: RealtimeChannelEnv,
  domain: Schema.String,
  reference: Schema.optional(Schema.String),
}) {
  get channelString(): string {
    return this.reference
      ? `${this.environment}:${this.domain}:${this.reference}`
      : `${this.environment}:${this.domain}`
  }

  static domainChannel = Effect.fnUntraced(function* (
    environment: RealtimeChannelEnv,
    domain: string,
  ) {
    return yield* Schema.decodeUnknownEffect(RealtimeChannel)({
      environment,
      domain,
    }).pipe(Effect.mapError((error) => new RealtimeError({ message: error.message, cause: error })))
  })

  static participantChannel = Effect.fnUntraced(function* (
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
