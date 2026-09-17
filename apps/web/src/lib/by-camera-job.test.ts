import { describe, expect, it, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { MarathonsRepository } from '@blikka/db'
import { UploadSessionRepository } from '@blikka/kv-store'
import { SubmissionProcessor } from '@blikka/uploads/submission-processor'
import { UploadFinalizer } from '@blikka/uploads/participant-finalizer'
import {
  ValidationRunner,
  ValidationRunnerInvalidDataError,
} from '@blikka/uploads/validation-runner'
import { RealtimeEventsService } from '@blikka/realtime'
import { processByCameraJob } from './by-camera-job'

const key = 'demo/ABC/03/photo.jpg'
function harness({ stale = false, mode = 'by-camera', failValidationOnce = false } = {}) {
  const stages: string[] = []
  let failed = false
  const process = vi.fn(() =>
    Effect.sync(() => {
      stages.push('process')
    }),
  )
  const finalize = vi.fn(() =>
    Effect.sync(() => {
      stages.push('finalize')
      return { changed: true, changedToVerified: false, status: 'completed' as const }
    }),
  )
  const execute = vi.fn(() =>
    Effect.gen(function* () {
      stages.push('validate')
      if (failValidationOnce && !failed) {
        failed = true
        return yield* Effect.fail(
          new ValidationRunnerInvalidDataError({ message: 'transient validation failure' }),
        )
      }
      return { changed: true, changedToVerified: true, status: 'verified' as const }
    }),
  )
  const emit = vi.fn(() => Effect.void)
  const run = () =>
    Effect.runPromise(
      processByCameraJob({ submissionKeys: [key] }).pipe(
        Effect.provideService(MarathonsRepository, {
          getMarathonByDomain: () => Effect.succeed(Option.some({ mode })),
        } as unknown as MarathonsRepository['Service']),
        Effect.provideService(UploadSessionRepository, {
          getSubmissionState: () =>
            Effect.succeed(
              Option.some({ key: stale ? 'old-key' : key, uploadSessionId: 'current' }),
            ),
          getParticipantState: () =>
            Effect.succeed(Option.some({ uploadSessionId: 'current', expectedCount: 1 })),
        } as unknown as UploadSessionRepository['Service']),
        Effect.provideService(SubmissionProcessor, { process }),
        Effect.provideService(UploadFinalizer, { finalize }),
        Effect.provideService(ValidationRunner, { execute }),
        Effect.provideService(RealtimeEventsService, {
          withEventResult: (effect) => effect,
          emitEventResult: emit,
          emitVotingVoteCast: () => Effect.void,
        }),
      ),
    )
  return { run, stages, process, emit }
}
describe('by-camera processing', () => {
  it('processes the active topic index and emits verification after all stages', async () => {
    const h = harness()
    await h.run()
    expect(h.stages).toEqual(['process', 'finalize', 'validate'])
    expect(h.process).toHaveBeenCalledWith({
      domain: 'demo',
      reference: 'ABC',
      orderIndex: 2,
      fileName: 'photo.jpg',
      key,
    })
    expect(h.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: 'participant-verified' }),
    )
  })
  it('drops a replaced upload before touching artifacts or finalizing', async () => {
    const h = harness({ stale: true })
    await h.run()
    expect(h.stages).toEqual([])
  })
  it('rejects marathon processing', async () => {
    const h = harness({ mode: 'marathon' })
    await expect(h.run()).rejects.toThrow('Only by-camera uploads')
    expect(h.stages).toEqual([])
  })
  it('retries finalization and validation even after artifacts were processed', async () => {
    const h = harness({ failValidationOnce: true })
    await expect(h.run()).rejects.toThrow('transient validation failure')
    await h.run()
    expect(h.stages).toEqual(['process', 'finalize', 'validate', 'process', 'finalize', 'validate'])
  })
})
