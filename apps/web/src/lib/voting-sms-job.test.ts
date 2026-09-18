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
    processVotingSmsJob({ votingSessionIds: [1] }, 'preview-job').pipe(
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

const { receipts } = vi.hoisted(() => ({ receipts: new Map<string, string>() }))
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: async (key: string) => receipts.get(key) ?? null,
      set: async (key: string, value: string) => {
        receipts.set(key, value)
        return 'OK'
      },
    }),
  },
}))

function batchHarness() {
  receipts.clear()
  vi.stubEnv('VERCEL_ENV', 'production')
  const send = vi.fn(() =>
    Effect.succeed({
      messageId: 'SMtest',
      phoneNumber: '+46700000000',
      status: 'success' as const,
    }),
  )
  const update = vi.fn<() => Effect.Effect<void, Error>>(() => Effect.void)
  const run = (jobId = 'job-1') =>
    Effect.runPromise(
      processVotingSmsJob({ votingSessionIds: [1] }, jobId).pipe(
        Effect.provideService(SMSService, { send } as unknown as SMSService['Service']),
        Effect.provideService(VotingRepository, {
          getVotingSessionsByIdsWithMarathon: () =>
            Effect.succeed([
              {
                id: 1,
                phoneEncrypted: 'encrypted',
                token: 'vote-token',
                marathon: { name: 'Demo', domain: 'demo' },
                // The batch producer recorded a successful email before enqueueing the SMS.
                notificationLastSentAt: '2026-09-18T07:00:00Z',
              },
            ]),
          updateMultipleLastNotificationSentAt: update,
        } as unknown as VotingRepository['Service']),
        Effect.provideService(PhoneNumberEncryptionService, {
          decrypt: () => Effect.succeed('+46700000000'),
        } as unknown as PhoneNumberEncryptionService['Service']),
      ),
    )
  return { run, send, update }
}

it('sends SMS even when an email has already set the notification timestamp', async () => {
  const h = batchHarness()
  await h.run()
  expect(h.send).toHaveBeenCalledTimes(1)
})

it('does not send the same voter twice when the queue retries a completed send', async () => {
  const h = batchHarness()
  await h.run()
  await h.run()
  expect(h.send).toHaveBeenCalledTimes(1)
})

it('allows a new notification job to send again', async () => {
  const h = batchHarness()
  await h.run('job-1')
  await h.run('job-2')
  expect(h.send).toHaveBeenCalledTimes(2)
})

it('retries a failed database update without sending an accepted SMS again', async () => {
  const h = batchHarness()
  h.update.mockReturnValueOnce(Effect.fail(new Error('database unavailable')))
  await expect(h.run()).rejects.toThrow('database unavailable')
  await h.run()
  expect(h.send).toHaveBeenCalledTimes(1)
  expect(h.update).toHaveBeenCalledTimes(2)
})
