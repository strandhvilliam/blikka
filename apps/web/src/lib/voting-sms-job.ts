import { Redis } from '@upstash/redis'
import { Effect, Schema } from 'effect'
import { VotingRepository } from '@blikka/db'
import { SMSService } from '@blikka/aws'
import {
  PhoneNumberEncryptionService,
  EncryptedPhoneNumber,
} from '@blikka/api/core/utils/phone-number-encryption'

const VotingSmsJob = Schema.Struct({
  votingSessionIds: Schema.Array(Schema.Number),
  forceResend: Schema.optional(Schema.Boolean),
  requestedAt: Schema.optional(Schema.String),
})

export const processVotingSmsJob = Effect.fn('processVotingSmsJob')(function* (
  payload: unknown,
  jobId: string,
) {
  const { votingSessionIds } = yield* Schema.decodeUnknownEffect(VotingSmsJob)(payload)
  // Vercel previews also use NODE_ENV=production. Never send from a preview deployment.
  if (process.env.VERCEL_ENV !== 'production') {
    yield* Effect.logWarning('Skipping voting SMS job outside production', {
      jobId,
      environment: process.env.VERCEL_ENV,
    })
    return
  }
  const redis = yield* Effect.sync(() => Redis.fromEnv())
  yield* Effect.logInfo('Processing voting SMS job', {
    jobId,
    sessionCount: votingSessionIds.length,
  })
  const repository = yield* VotingRepository
  const encryption = yield* PhoneNumberEncryptionService
  const sms = yield* SMSService
  const sessions = yield* repository.getVotingSessionsByIdsWithMarathon({
    ids: [...new Set(votingSessionIds)],
  })
  for (const session of sessions) {
    if (!session.marathon || !session.phoneEncrypted) {
      yield* Effect.logWarning('Skipping voting SMS without marathon or phone', {
        jobId,
        sessionId: session.id,
      })
      continue
    }
    // The database timestamp is shared with email and cannot prove an SMS was sent.
    const receiptKey = `vercel:voting-sms:${jobId}:${session.id}`
    const sentAt = yield* Effect.tryPromise(() => redis.get<string>(receiptKey))
    if (sentAt) {
      // Complete the database update if the previous attempt failed after recording the receipt.
      if (
        !session.notificationLastSentAt ||
        new Date(session.notificationLastSentAt) < new Date(sentAt)
      ) {
        yield* repository.updateMultipleLastNotificationSentAt({
          ids: [session.id],
          notificationLastSentAt: sentAt,
        })
      }
      yield* Effect.logInfo('Skipping SMS already sent by this job', {
        jobId,
        sessionId: session.id,
      })
      continue
    }
    const phoneNumber = yield* encryption.decrypt({
      encrypted: EncryptedPhoneNumber(session.phoneEncrypted),
    })
    yield* sms.send({
      phoneNumber,
      message: `Voting is starting for ${session.marathon.name}! Vote here: https://${session.marathon.domain}.${process.env.NEXT_PUBLIC_BLIKKA_PRODUCTION_URL || 'blikka.app'}/live/vote/${session.token}`,
    })
    const notificationLastSentAt = new Date().toISOString()
    yield* Effect.tryPromise(() =>
      redis.set(receiptKey, notificationLastSentAt, { ex: 60 * 60 * 24 * 30 }),
    )
    yield* repository.updateMultipleLastNotificationSentAt({
      ids: [session.id],
      notificationLastSentAt,
    })
    yield* Effect.logInfo('Voting SMS accepted by provider', { jobId, sessionId: session.id })
  }
})
