import { Config, Context, Effect, Layer } from 'effect'
import { RealtimeEventsService, RealtimeEventsServiceLayer } from '@blikka/realtime'

import { type InitializeByCameraUploadInput, type InitializeUploadFlow } from './contracts'
import {
  ByCameraUploadInitializerService,
  ByCameraUploadInitializerServiceLayer,
  type ByCameraUploadInitializerError,
} from './initialize-by-camera-upload'
import {
  MarathonUploadInitializerService,
  MarathonUploadInitializerServiceLayer,
  type MarathonUploadInitializerError,
} from './initialize-marathon-upload'

type UploadInitializerError = MarathonUploadInitializerError | ByCameraUploadInitializerError

export class UploadInitializerService extends Context.Service<
  UploadInitializerService,
  {
    /**
     * Classic marathon: when uploads are open, upserts the participant, replaces submissions for the class topic slice,
     * initializes KV (+ optional per-topic EXIF), and returns presigned PUT URLs; emits upload-flow-initialized.
     */
    readonly initializeUploadFlow: (input: InitializeUploadFlow) => Effect.Effect<
      {
        uploadSessionId: string
        reference: string
        uploads: { key: string; url: string; contentType: string }[]
      },
      UploadInitializerError
    >

    /**
     * By-camera upload flow for device (`variant: 'device'`) or staff laptop (`variant: 'staff'`): resolves participant,
     * may replace prior active-topic submission when allowed, then one submission, KV session, EXIF seed, and presigned PUT;
     * emits upload-flow-initialized.
     */
    readonly initializeByCameraUpload: (input: InitializeByCameraUploadInput) => Effect.Effect<
      {
        participantId: number
        reference: string
        uploadSessionId: string
        uploads: { key: string; url: string; contentType: string }[]
      },
      UploadInitializerError
    >
  }
>()('@blikka/api/UploadInitializerService') {}

const makeUploadInitializerService = Effect.gen(function* () {
  const realtimeEvents = yield* RealtimeEventsService
  const marathonUploadInitializer = yield* MarathonUploadInitializerService
  const byCameraUploadInitializer = yield* ByCameraUploadInitializerService
  const environment = yield* Config.string('NODE_ENV').pipe(
    Config.map((env) => (env === 'production' ? 'prod' : 'dev')),
  )

  const initializeUploadFlow: UploadInitializerService['Service']['initializeUploadFlow'] =
    Effect.fn('UploadInitializerService.initializeUploadFlow')(function* (input) {
      return yield* realtimeEvents.withEventResult(
        marathonUploadInitializer.initializeUploadFlow(input),
        {
          eventKey: 'upload-flow-initialized',
          environment,
          domain: input.domain,
          reference: input.reference,
        },
      )
    })

  const initializeByCameraUpload: UploadInitializerService['Service']['initializeByCameraUpload'] =
    Effect.fn('UploadInitializerService.initializeByCameraUpload')(function* (input) {
      return yield* realtimeEvents.withEventResult(
        byCameraUploadInitializer.initializeByCameraUpload(input),
        {
          eventKey: 'upload-flow-initialized',
          environment,
          domain: input.domain,
        },
      )
    })

  return UploadInitializerService.of({
    initializeUploadFlow,
    initializeByCameraUpload,
  })
})

export const UploadInitializerServiceLayerNoDeps = Layer.effect(
  UploadInitializerService,
  makeUploadInitializerService,
)

export const UploadInitializerServiceLayer = UploadInitializerServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      MarathonUploadInitializerServiceLayer,
      ByCameraUploadInitializerServiceLayer,
      RealtimeEventsServiceLayer,
    ),
  ),
)
