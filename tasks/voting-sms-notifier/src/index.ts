import { type SQSRecord } from "aws-lambda"
import { LambdaHandler, type SQSEvent } from "@effect-aws/lambda"
import { Config, Effect, Layer, Schema } from "effect"
import { Database } from "@blikka/db"
import { SMSService } from "@blikka/aws"
import { PubSubLoggerService } from "@blikka/pubsub"
import {
  getRealtimeChannelEnvironmentFromNodeEnv,
  type RealtimeChannelEnv,
} from "@blikka/realtime"
import { TelemetryLayer } from "@blikka/telemetry"
import {
  PhoneNumberEncryptionService,
  type EncryptedPhoneNumber,
} from "@blikka/api/trpc/utils/phone-number-encryption"

const TASK_NAME = "voting-sms-notifier"
const SMS_CONCURRENCY = 5

const VotingSmsQueueMessageSchema = Schema.Struct({
  votingSessionIds: Schema.Array(Schema.Number),
  forceResend: Schema.optional(Schema.Boolean),
})

class VotingSmsNotifierError extends Schema.TaggedErrorClass<VotingSmsNotifierError>()(
  "VotingSmsNotifierError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

interface VotingSmsDeliveryOutcome {
  sessionId: number
  status: "sent" | "skipped" | "failed"
  reason?: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getEnvironment(): Extract<RealtimeChannelEnv, "prod" | "dev"> {
  return getRealtimeChannelEnvironmentFromNodeEnv(process.env.NODE_ENV)
}

function buildVotingInviteMessage({
  marathonName,
  domain,
  token,
}: {
  marathonName: string
  domain: string
  token: string
}) {
  return `Voting is starting for ${marathonName}! Vote here: https://${domain}.blikka.app/live/vote/${token}`
}

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const db = yield* Database
    const smsService = yield* SMSService
    const phoneEncryption = yield* PhoneNumberEncryptionService
    const environment = yield* Config.string("NODE_ENV").pipe(
      Config.map(getRealtimeChannelEnvironmentFromNodeEnv),
    )
    const shouldSendVotingSms = environment === "prod"

    const parseQueueMessage = Effect.fn(
      "voting-sms-notifier.parseQueueMessage",
    )(function* (record: SQSRecord) {
      const parsed = yield* Effect.try({
        try: () => JSON.parse(record.body),
        catch: (error) =>
          new VotingSmsNotifierError({
            message: "Failed to parse voting SMS queue message",
            cause: error,
          }),
      })

      return yield* Schema.decodeUnknownEffect(VotingSmsQueueMessageSchema)(
        parsed,
      ).pipe(
        Effect.mapError(
          (error) =>
            new VotingSmsNotifierError({
              message: "Invalid voting SMS queue message",
              cause: error,
            }),
        ),
      )
    })

    const processSQSRecord = Effect.fn(
      "voting-sms-notifier.processSQSRecord",
    )(function* (record: SQSRecord) {
      const { votingSessionIds, forceResend } = yield* parseQueueMessage(record)
      const uniqueVotingSessionIds = Array.from(new Set(votingSessionIds))

      if (uniqueVotingSessionIds.length === 0) {
        yield* Effect.logInfo("Skipping empty voting SMS chunk")
        return
      }

      if (!shouldSendVotingSms) {
        yield* Effect.logInfo(
          "Skipping voting SMS chunk because environment is not production",
        )
        return
      }

      const sessions = yield* db.votingQueries.getVotingSessionsByIdsWithMarathon(
        {
          ids: uniqueVotingSessionIds,
        },
      )

      const foundSessionIds = new Set(sessions.map((session) => session.id))
      const missingSessionIds = uniqueVotingSessionIds.filter(
        (id) => !foundSessionIds.has(id),
      )

      if (missingSessionIds.length > 0) {
        yield* Effect.logWarning("Voting sessions missing from chunk")
      }

      const outcomes = yield* Effect.forEach(
        sessions,
        (session) =>
          Effect.gen(function* () {
            if (!session.marathon) {
              yield* Effect.logError("Marathon not found for voting session")
              return {
                sessionId: session.id,
                status: "failed",
                reason: "marathon-not-found",
              } satisfies VotingSmsDeliveryOutcome
            }

            if (!session.phoneEncrypted) {
              yield* Effect.logInfo(
                "Skipping voting session without encrypted phone number",
              )
              return {
                sessionId: session.id,
                status: "skipped",
                reason: "missing-phone",
              } satisfies VotingSmsDeliveryOutcome
            }

            if (!forceResend && session.notificationLastSentAt) {
              yield* Effect.logInfo(
                "Skipping voting session that already has a sent notification timestamp",
              )
              return {
                sessionId: session.id,
                status: "skipped",
                reason: "already-notified",
              } satisfies VotingSmsDeliveryOutcome
            }

            const phoneNumber = yield* phoneEncryption
              .decrypt({
                encrypted: session.phoneEncrypted as EncryptedPhoneNumber,
              })
              .pipe(
                Effect.mapError(
                  (error) =>
                    new VotingSmsNotifierError({
                      message: `Failed to decrypt phone number for voting session ${session.id}`,
                      cause: error,
                    }),
                ),
              )

            yield* smsService
              .send({
                phoneNumber,
                message: buildVotingInviteMessage({
                  marathonName: session.marathon.name,
                  domain: session.marathon.domain,
                  token: session.token,
                }),
              })
              .pipe(
                Effect.mapError(
                  (error) =>
                    new VotingSmsNotifierError({
                      message: `Failed to send voting SMS for session ${session.id}`,
                      cause: error,
                    }),
                ),
              )

            yield* db.votingQueries.updateMultipleLastNotificationSentAt({
              ids: [session.id],
              notificationLastSentAt: new Date().toISOString(),
            })

            return {
              sessionId: session.id,
              status: "sent",
            } satisfies VotingSmsDeliveryOutcome
          }).pipe(
            Effect.annotateLogs({ votingSessionId: String(session.id) }),
            Effect.catch((error) =>
              Effect.logError("Voting session SMS failed", error).pipe(
                Effect.andThen(
                  Effect.succeed({
                    sessionId: session.id,
                    status: "failed",
                    reason: getErrorMessage(error),
                  } satisfies VotingSmsDeliveryOutcome),
                ),
              ),
            ),
          ),
        { concurrency: SMS_CONCURRENCY },
      )

      const deliveredCount = outcomes.filter(
        (outcome: VotingSmsDeliveryOutcome) => outcome.status === "sent",
      ).length
      const skippedCount = outcomes.filter(
        (outcome: VotingSmsDeliveryOutcome) => outcome.status === "skipped",
      ).length
      const failedCount = outcomes.filter(
        (outcome: VotingSmsDeliveryOutcome) => outcome.status === "failed",
      ).length

      yield* Effect.logInfo("Voting SMS chunk processed").pipe(
        Effect.annotateLogs({
          requestedSessionCount: String(uniqueVotingSessionIds.length),
          deliveredCount: String(deliveredCount),
          skippedCount: String(skippedCount),
          failedCount: String(failedCount),
          forceResend: String(forceResend === true),
          missingSessionCount: String(missingSessionIds.length),
        }),
      )
    })

    yield* Effect.forEach(event.Records, (record) => processSQSRecord(record), {
      concurrency: 1,
    })
  }).pipe(
    Effect.withSpan("VotingSmsNotifier.handler"),
    Effect.tapError((error) =>
      Effect.logError("Voting SMS notifier failed", error),
    ),
  )

const serviceLayer = Layer.mergeAll(
  Database.layer,
  SMSService.layer,
  PhoneNumberEncryptionService.layer,
  PubSubLoggerService.withTaskName(TASK_NAME),
  TelemetryLayer(`blikka-${getEnvironment()}-${TASK_NAME}`),
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
