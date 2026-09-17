import { Layer, ManagedRuntime } from 'effect'
import { NodeServices } from '@effect/platform-node'
import { MarathonsRepositoryLayer } from '@blikka/db'
import { UploadSessionRepositoryLayer } from '@blikka/kv-store'
import { SubmissionProcessorLayer } from '@blikka/uploads/submission-processor'
import { UploadFinalizerLayer } from '@blikka/uploads/participant-finalizer'
import { ValidationRunnerLayer } from '@blikka/uploads/validation-runner'
import { RealtimeEventsServiceLayer } from '@blikka/realtime'
import { queueConsumer } from '@/lib/vercel-queue'
import { processByCameraJob } from '@/lib/by-camera-job'

export const runtime = 'nodejs'
export const maxDuration = 300
const jobRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    SubmissionProcessorLayer,
    UploadFinalizerLayer,
    ValidationRunnerLayer,
    MarathonsRepositoryLayer,
    UploadSessionRepositoryLayer,
    RealtimeEventsServiceLayer,
  ).pipe(Layer.provide(NodeServices.layer)),
)

export const POST = queueConsumer((payload) => jobRuntime.runPromise(processByCameraJob(payload)))
