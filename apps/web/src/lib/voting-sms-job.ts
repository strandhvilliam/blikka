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

export const processVotingSmsJob = Effect.fn('processVotingSmsJob')(function* (payload: unknown) {
  const { votingSessionIds, forceResend, requestedAt } =
    yield* Schema.decodeUnknownEffect(VotingSmsJob)(payload)
  // Vercel previews also use NODE_ENV=production. Never send from a preview deployment.
  if (process.env.VERCEL_ENV !== 'production') return
  const repository = yield* VotingRepository
  const encryption = yield* PhoneNumberEncryptionService
  const sms = yield* SMSService
  const sessions = yield* repository.getVotingSessionsByIdsWithMarathon({
    ids: [...new Set(votingSessionIds)],
  })
  for (const session of sessions) {
    if (!session.marathon || !session.phoneEncrypted) continue
    if (
      session.notificationLastSentAt &&
      (!forceResend ||
        (requestedAt && new Date(session.notificationLastSentAt) >= new Date(requestedAt)))
    )
      continue
    const phoneNumber = yield* encryption.decrypt({
      encrypted: EncryptedPhoneNumber(session.phoneEncrypted),
    })
    yield* sms.send({
      phoneNumber,
      message: `Voting is starting for ${session.marathon.name}! Vote here: https://${session.marathon.domain}.${process.env.NEXT_PUBLIC_BLIKKA_PRODUCTION_URL || 'blikka.app'}/live/vote/${session.token}`,
    })
    yield* repository.updateMultipleLastNotificationSentAt({
      ids: [session.id],
      notificationLastSentAt: new Date().toISOString(),
    })
  }
})
