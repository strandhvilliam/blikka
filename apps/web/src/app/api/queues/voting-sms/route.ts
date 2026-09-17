import { Layer, ManagedRuntime } from 'effect'
import { VotingRepositoryLayer } from '@blikka/db'
import { SMSServiceLayer } from '@blikka/aws'
import { PhoneNumberEncryptionServiceLayer } from '@blikka/api/core/utils/phone-number-encryption'
import { queueConsumer } from '@/lib/vercel-queue'
import { processVotingSmsJob } from '@/lib/voting-sms-job'

export const runtime = 'nodejs'
export const maxDuration = 300
const jobRuntime = ManagedRuntime.make(
  Layer.mergeAll(VotingRepositoryLayer, SMSServiceLayer, PhoneNumberEncryptionServiceLayer),
)
export const POST = queueConsumer((payload) => jobRuntime.runPromise(processVotingSmsJob(payload)))
