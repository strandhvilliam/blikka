import { Effect, Option, Schema } from 'effect'
import { MarathonsRepository } from '@blikka/db'
import { UploadSessionRepository } from '@blikka/kv-store'
import { SubmissionProcessor } from '@blikka/uploads/submission-processor'
import { UploadFinalizer } from '@blikka/uploads/participant-finalizer'
import { ValidationRunner } from '@blikka/uploads/validation-runner'
import { RealtimeEventsService, getRealtimeChannelEnvironmentFromNodeEnv } from '@blikka/realtime'

export const UploadJobSchema = Schema.Struct({ submissionKeys: Schema.Array(Schema.String) })

export const processByCameraJob = Effect.fn('processByCameraJob')(function* (payload: unknown) {
  const { submissionKeys } = yield* Schema.decodeUnknownEffect(UploadJobSchema)(payload)
  const kv = yield* UploadSessionRepository
  const marathons = yield* MarathonsRepository
  const processor = yield* SubmissionProcessor
  const finalizer = yield* UploadFinalizer
  const validation = yield* ValidationRunner
  const realtime = yield* RealtimeEventsService
  const environment = getRealtimeChannelEnvironmentFromNodeEnv(process.env.NODE_ENV)

  for (const key of submissionKeys) {
    const parts = key.split('/')
    const [domain, reference, index, fileName] = parts
    if (
      parts.length !== 4 ||
      !domain ||
      !reference ||
      !fileName ||
      !index ||
      !/^\d+$/.test(index) ||
      Number(index) < 1
    ) {
      return yield* Effect.fail(new Error('Invalid submission key'))
    }
    const orderIndex = Number(index) - 1
    const marathon = yield* marathons.getMarathonByDomain({ domain })
    if (Option.isNone(marathon) || marathon.value.mode !== 'by-camera') {
      return yield* Effect.fail(new Error('Only by-camera uploads are enabled'))
    }
    const submission = yield* kv.getSubmissionState(domain, reference, orderIndex)
    const participant = yield* kv.getParticipantState(domain, reference)
    if (
      Option.isNone(submission) ||
      Option.isNone(participant) ||
      submission.value.key !== key ||
      submission.value.uploadSessionId !== participant.value.uploadSessionId
    )
      continue
    if (participant.value.expectedCount !== 1) {
      return yield* Effect.fail(new Error('Only single-photo sessions are enabled'))
    }
    const input = { domain, reference, uploadSessionId: participant.value.uploadSessionId }
    const target = { environment, domain, reference }
    yield* realtime.withEventResult(
      processor.process({ domain, reference, orderIndex, fileName, key }),
      {
        ...target,
        eventKey: 'submission-processed',
        metadata: { orderIndex },
      },
    )
    // Each stage checks the session again. Retry all stages even if artifact processing was done.
    const finalized = yield* realtime.withEventResult(finalizer.finalize(input), {
      ...target,
      eventKey: 'participant-finalized',
    })
    const validated = yield* realtime.withEventResult(validation.execute(input), {
      ...target,
      eventKey: 'participant-validated',
    })
    if (finalized.changedToVerified || validated.changedToVerified) {
      yield* realtime.emitEventResult({
        ...target,
        eventKey: 'participant-verified',
        outcome: 'success',
        timestamp: Date.now(),
        channels: 'participant',
      })
    }
  }
})
