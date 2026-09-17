import { afterEach, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { VotingRepository } from '@blikka/db'
import { SMSService } from '@blikka/aws'
import { PhoneNumberEncryptionService } from '@blikka/api/core/utils/phone-number-encryption'
import { processVotingSmsJob } from './voting-sms-job'

afterEach(() => vi.unstubAllEnvs())
it('never sends queued SMS from Vercel previews', async () => {
  vi.stubEnv('VERCEL_ENV', 'preview')
  const send = vi.fn(() => Effect.void)
  await Effect.runPromise(
    processVotingSmsJob({ votingSessionIds: [1] }).pipe(
      Effect.provideService(SMSService, { send } as unknown as SMSService['Service']),
      Effect.provideService(VotingRepository, {} as VotingRepository['Service']),
      Effect.provideService(
        PhoneNumberEncryptionService,
        {} as PhoneNumberEncryptionService['Service'],
      ),
    ),
  )
  expect(send).not.toHaveBeenCalled()
})
