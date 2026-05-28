import { Config, Context, Effect, Layer, Option } from 'effect'
import {
  DbError,
  DbLayer,
  MarathonsRepository,
  ParticipantsRepository,
  SubmissionsRepository,
  type Marathon,
  type NewParticipant,
  type Topic,
} from '@blikka/db'
import {
  S3ClientError,
  S3Service,
  S3ServiceLayer,
  SQSService,
  SQSServiceError,
  SQSServiceLayer,
} from '@blikka/aws'
import {
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  type UploadSessionRepositoryError,
} from '@blikka/kv-store'
import { RealtimeEventsService, RealtimeEventsServiceLayer } from '@blikka/realtime'
import {
  type CheckParticipantExists,
  type GetPublicMarathon,
  type GetUploadStatus,
  type PrepareUploadFlow,
  type RefreshPresignedUploads,
  type ReTriggerUploadFlow,
  type ResolveByCameraParticipantByPhone,
} from './contracts'
import { BadRequestError } from '../errors'
import {
  PhoneNumberEncryptionService,
  PhoneNumberEncryptionServiceLayer,
  type PhoneNumberEncryptionError,
} from '../utils/phone-number-encryption'
import { getActiveByCameraTopicOrBadRequest, isSuccessfulActiveTopicUpload } from '../shared'
import {
  encryptOptionalPhoneNumber,
  ensureDeviceGroupExists,
  getCompetitionClassOrFail,
  isParticipantFinalized,
  maybeRecordParticipantTermsAcceptance,
  normalizeUploadContentType,
} from '../shared/upload'
import { PublicMarathonCache, PublicMarathonCacheLayer } from './public-marathon-cache'

export interface PublicMarathonForClient extends Omit<Marathon, 'topics'> {
  topics: Topic[]
}

export class UploadFlowService extends Context.Service<
  UploadFlowService,
  {
    /** Loads the marathon for a domain and masks non-public topic titles; by-camera responses expose at most one active topic. */
    readonly getPublicMarathon: (
      input: GetPublicMarathon,
    ) => Effect.Effect<PublicMarathonForClient, DbError | BadRequestError, never>

    /** Returns whether a participant `reference` exists under `domain` and their stored status when it does. */
    readonly checkParticipantExists: (
      input: CheckParticipantExists,
    ) => Effect.Effect<
      { exists: false; status: null } | { exists: true; status: string },
      DbError,
      never
    >

    /**
     * Marathon mode only: validates competition class and device group, blocks bad participant states, then creates or updates
     * a prepared participant (encrypted phone) and optional terms row; emits participant-prepared.
     */
    readonly prepareUploadFlow: (
      input: PrepareUploadFlow,
    ) => Effect.Effect<
      { participantId: number; status: string },
      DbError | PhoneNumberEncryptionError | BadRequestError,
      never
    >

    /**
     * Looks up a by-camera participant by phone for the current marathon and active topic; indicates whether they may upload
     * again for that topic or already have a successful upload in flight.
     */
    readonly resolveByCameraParticipantByPhone: (
      input: ResolveByCameraParticipantByPhone,
    ) => Effect.Effect<
      | {
          match: false
          participantId?: undefined
          reference?: undefined
          activeTopicUploadState?: undefined
        }
      | {
          match: true
          participantId: number
          reference: string
          activeTopicUploadState: 'eligible' | 'already-uploaded'
        },
      DbError | PhoneNumberEncryptionError | BadRequestError | UploadSessionRepositoryError,
      never
    >

    /** Reads KV participant + per-order-index submission states for polling upload progress. */
    readonly getUploadStatus: (input: GetUploadStatus) => Effect.Effect<
      {
        participant: {
          uploadSessionId: string
          expectedCount: number
          processedIndexes: readonly number[]
          validated: boolean
          finalized: boolean
          errors: readonly string[]
        } | null
        submissions: {
          key: string
          uploadSessionId: string
          orderIndex: number
          uploaded: boolean
          thumbnailKey: string | null
          exifProcessed: boolean
        }[]
      },
      UploadSessionRepositoryError,
      never
    >

    /** Issues fresh presigned PUT URLs for existing submission keys while the participant is not finalized. */
    readonly refreshPresignedUploads: (
      input: RefreshPresignedUploads,
    ) => Effect.Effect<
      { key: string; url: string; contentType: string }[],
      DbError | S3ClientError | BadRequestError | UploadSessionRepositoryError,
      never
    >

    /** Sends the current KV session’s submission keys back through the upload processor queue. */
    readonly reTriggerUploadFlow: (
      input: ReTriggerUploadFlow,
    ) => Effect.Effect<
      undefined,
      BadRequestError | UploadSessionRepositoryError | SQSServiceError,
      never
    >
  }
>()('@blikka/api/UploadFlowService') {}

const makeUploadFlowService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const submissionsRepository = yield* SubmissionsRepository
  const kv = yield* UploadSessionRepository
  const phoneEncryption = yield* PhoneNumberEncryptionService
  const realtimeEvents = yield* RealtimeEventsService
  const publicMarathonCache = yield* PublicMarathonCache
  const s3 = yield* S3Service
  const sqs = yield* SQSService
  const bucketName = yield* Config.string('SUBMISSIONS_BUCKET_NAME')
  const queueUrl = yield* Config.string('UPLOAD_PROCESSOR_QUEUE_URL')
  const environment = yield* Config.string('NODE_ENV').pipe(
    Config.map((env) => (env === 'production' ? 'prod' : 'dev')),
  )

  const getActiveTopicSubmissionOrNull = Effect.fn(
    'UploadFlowService.getActiveTopicSubmissionOrNull',
  )(function* ({ participantId, topicId }: { participantId: number; topicId: number }) {
    return yield* submissionsRepository
      .getSubmissionByParticipantIdAndTopicId({
        participantId,
        topicId,
      })
      .pipe(
        Effect.map((submission) =>
          Option.match(submission, {
            onSome: (value) => value,
            onNone: () => null,
          }),
        ),
      )
  })

  const hasSuccessfulActiveTopicUpload = Effect.fn(
    'UploadFlowService.hasSuccessfulActiveTopicUpload',
  )(function* ({
    domain,
    reference,
    activeTopic,
    submissionStatus,
  }: {
    domain: string
    reference: string
    activeTopic: { id: number; orderIndex: number; visibility: string }
    submissionStatus?: string | null
  }) {
    const participantState = yield* kv.getParticipantState(domain, reference)
    const submissionState = yield* kv.getSubmissionState(domain, reference, activeTopic.orderIndex)

    return isSuccessfulActiveTopicUpload({
      submissionStatus,
      participantState,
      submissionState,
      activeTopicOrderIndex: activeTopic.orderIndex,
    })
  })

  const resolveExistingByCameraParticipant = Effect.fn(
    'UploadFlowService.resolveExistingByCameraParticipant',
  )(function* ({ domain, phoneNumber }: { domain: string; phoneNumber: string }) {
    const marathon = yield* marathonsRepository.getMarathonByDomainWithOptions({ domain }).pipe(
      Effect.flatMap((option) =>
        Option.match(option, {
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              new BadRequestError({
                message: `[${domain}] Marathon not found`,
              }),
            ),
        }),
      ),
    )

    if (marathon.mode !== 'by-camera') {
      return yield* Effect.fail(
        new BadRequestError({
          message: `[${domain}] Marathon is not in by-camera mode`,
        }),
      )
    }

    const activeTopic = yield* getActiveByCameraTopicOrBadRequest({
      domain,
      topics: marathon.topics,
    })
    const phoneHash = yield* phoneEncryption.hashLookup({ phoneNumber })
    const existingParticipant = yield* participantsRepository.getByPhoneHashForByCamera({
      marathonId: marathon.id,
      phoneHash,
    })

    if (Option.isNone(existingParticipant)) {
      return {
        marathon,
        activeTopic,
        phoneHash,
        existingParticipant: null,
        activeTopicSubmission: null,
        activeTopicUploadState: 'eligible' as const,
      }
    }

    const activeTopicSubmission = yield* getActiveTopicSubmissionOrNull({
      participantId: existingParticipant.value.id,
      topicId: activeTopic.id,
    })

    const alreadyUploaded = yield* hasSuccessfulActiveTopicUpload({
      domain,
      reference: existingParticipant.value.reference,
      activeTopic,
      submissionStatus: activeTopicSubmission?.status,
    })

    return {
      marathon,
      activeTopic,
      phoneHash,
      existingParticipant: existingParticipant.value,
      activeTopicSubmission,
      activeTopicUploadState: alreadyUploaded
        ? ('already-uploaded' as const)
        : ('eligible' as const),
    }
  })

  const getPublicMarathon: UploadFlowService['Service']['getPublicMarathon'] = Effect.fn(
    'UploadFlowService.getPublicMarathon',
  )(function* ({ domain }) {
    const cached = yield* publicMarathonCache.get(domain)
    if (Option.isSome(cached)) {
      return cached.value
    }

    const marathon = yield* marathonsRepository.getMarathonByDomainWithOptions({ domain }).pipe(
      Effect.flatMap((option) =>
        Option.match(option, {
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              new BadRequestError({
                message: `[${domain}] Marathon not found`,
              }),
            ),
        }),
      ),
    )

    const processedTopics = marathon.topics
      .reduce((acc, topic) => {
        if (topic.visibility !== 'public' && topic.visibility !== 'active') {
          acc.push({
            ...topic,
            name: 'Redacted',
          })
        } else {
          acc.push(topic)
        }
        return acc
      }, [] as Topic[])
      .sort((a, b) => a.orderIndex - b.orderIndex)

    const topics =
      marathon.mode === 'by-camera'
        ? processedTopics.filter((topic) => topic.visibility === 'active').slice(0, 1)
        : processedTopics

    const publicMarathon = {
      ...marathon,
      topics,
    }

    yield* publicMarathonCache.set(domain, publicMarathon)

    return publicMarathon
  })

  const checkParticipantExists: UploadFlowService['Service']['checkParticipantExists'] = Effect.fn(
    'UploadFlowService.checkParticipantExists',
  )(function* ({ domain, reference }) {
    const participant = yield* participantsRepository.getParticipantByReference({
      domain,
      reference,
    })

    return Option.match(participant, {
      onSome: (existingParticipant) => ({
        exists: true as const,
        status: existingParticipant.status,
      }),
      onNone: () => ({
        exists: false as const,
        status: null,
      }),
    })
  })

  const prepareUploadFlow: UploadFlowService['Service']['prepareUploadFlow'] = Effect.fn(
    'UploadFlowService.prepareUploadFlow',
  )(function* ({
    domain,
    reference,
    firstname,
    lastname,
    email,
    competitionClassId,
    deviceGroupId,
    phoneNumber,
    termsAccepted,
    acceptedLocale,
  }) {
    const executeEffect = Effect.gen(function* () {
      const marathon = yield* marathonsRepository.getMarathonByDomainWithOptions({ domain }).pipe(
        Effect.flatMap((option) =>
          Option.match(option, {
            onSome: Effect.succeed,
            onNone: () =>
              Effect.fail(
                new BadRequestError({
                  message: `[${domain}] Marathon not found`,
                }),
              ),
          }),
        ),
      )

      if (marathon.mode !== 'marathon') {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}] Prepare flow is only available in marathon mode`,
          }),
        )
      }

      yield* getCompetitionClassOrFail({
        domain,
        marathon,
        competitionClassId,
      })
      yield* ensureDeviceGroupExists({
        domain,
        marathon,
        deviceGroupId,
      })

      const existingParticipant = yield* participantsRepository.getParticipantByReference({
        reference,
        domain,
      })

      if (Option.isSome(existingParticipant)) {
        if (isParticipantFinalized(existingParticipant.value.status)) {
          return yield* Effect.fail(
            new BadRequestError({
              message: `[${domain}|${reference}] Participant already completed upload flow`,
            }),
          )
        }

        if (existingParticipant.value.status === 'initialized') {
          return yield* Effect.fail(
            new BadRequestError({
              message: `[${domain}|${reference}] Participant already started upload flow`,
            }),
          )
        }
      }

      const { encrypted, hash } = yield* encryptOptionalPhoneNumber(phoneEncryption, phoneNumber)

      const participantData = {
        reference,
        domain,
        competitionClassId,
        deviceGroupId,
        marathonId: marathon.id,
        firstname,
        lastname,
        email,
        status: 'prepared',
        phoneHash: hash,
        phoneEncrypted: encrypted,
      } satisfies NewParticipant

      const participant = yield* Option.match(existingParticipant, {
        onSome: (existing) =>
          participantsRepository.updateParticipantById({
            id: existing.id,
            data: participantData,
          }),
        onNone: () =>
          participantsRepository.createParticipant({
            data: participantData,
          }),
      })

      yield* maybeRecordParticipantTermsAcceptance(participantsRepository, {
        participant,
        marathon,
        domain,
        termsAccepted,
        acceptedLocale,
        source: 'participant',
      })

      return {
        participantId: participant.id,
        status: participant.status,
      }
    })

    return yield* realtimeEvents.withEventResult(executeEffect, {
      eventKey: 'participant-prepared',
      environment,
      domain,
      reference,
    })
  })

  const resolveByCameraParticipantByPhone: UploadFlowService['Service']['resolveByCameraParticipantByPhone'] =
    Effect.fn('UploadFlowService.resolveByCameraParticipantByPhone')(function* ({
      domain,
      phoneNumber,
    }) {
      const resolved = yield* resolveExistingByCameraParticipant({
        domain,
        phoneNumber,
      })

      if (!resolved.existingParticipant) {
        return {
          match: false as const,
        }
      }

      return {
        match: true as const,
        participantId: resolved.existingParticipant.id,
        reference: resolved.existingParticipant.reference,
        activeTopicUploadState: resolved.activeTopicUploadState,
      }
    })

  const getUploadStatus: UploadFlowService['Service']['getUploadStatus'] = Effect.fn(
    'UploadFlowService.getUploadStatus',
  )(function* ({ domain, reference, orderIndexes }) {
    const participantState = yield* kv.getParticipantState(domain, reference)
    const submissionStates = yield* kv.getAllSubmissionStates(domain, reference, [...orderIndexes])

    return {
      participant: Option.match(participantState, {
        onSome: (state) => ({
          uploadSessionId: state.uploadSessionId ?? '',
          expectedCount: state.expectedCount,
          processedIndexes: state.processedIndexes,
          validated: state.validated,
          finalized: state.finalized,
          errors: state.errors,
        }),
        onNone: () => null,
      }),
      submissions: submissionStates.map((state) => ({
        key: state.key,
        uploadSessionId: state.uploadSessionId ?? '',
        orderIndex: state.orderIndex,
        uploaded: state.uploaded,
        thumbnailKey: state.thumbnailKey,
        exifProcessed: state.exifProcessed,
      })),
    }
  })

  const refreshPresignedUploads: UploadFlowService['Service']['refreshPresignedUploads'] =
    Effect.fn('UploadFlowService.refreshPresignedUploads')(function* ({
      domain,
      reference,
      orderIndexes,
      uploadContentTypes,
    }) {
      if (orderIndexes.length === 0) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] orderIndexes must not be empty`,
          }),
        )
      }

      if (uploadContentTypes !== undefined && uploadContentTypes.length !== orderIndexes.length) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] uploadContentTypes length must match orderIndexes length (${orderIndexes.length})`,
          }),
        )
      }

      const participant = yield* participantsRepository
        .getParticipantByReference({
          domain,
          reference,
        })
        .pipe(
          Effect.andThen(
            Option.match({
              onSome: (resolvedParticipant) => Effect.succeed(resolvedParticipant),
              onNone: () =>
                Effect.fail(
                  new BadRequestError({
                    message: `[${domain}|${reference}] Participant not found`,
                  }),
                ),
            }),
          ),
        )

      if (isParticipantFinalized(participant.status)) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] Participant already completed upload flow`,
          }),
        )
      }

      const participantState = yield* kv.getParticipantState(domain, reference)
      if (Option.isNone(participantState)) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] Participant not initialized`,
          }),
        )
      }

      const submissionStates = yield* kv.getAllSubmissionStates(domain, reference, [
        ...orderIndexes,
      ])

      const submissionStatesByOrderIndex = new Map(
        submissionStates.map(
          (submissionState) => [submissionState.orderIndex, submissionState] as const,
        ),
      )

      const resolvedSubmissionStates = orderIndexes.map((orderIndex: number) => {
        const submissionState = submissionStatesByOrderIndex.get(orderIndex)
        if (!submissionState) {
          return null
        }

        return submissionState
      })

      const missingOrderIndexes = resolvedSubmissionStates.flatMap(
        (submissionState: (typeof submissionStates)[number] | null, index: number) =>
          submissionState === null ? [orderIndexes[index]!] : [],
      )

      if (missingOrderIndexes.length > 0) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] Missing submissions for order indexes: ${missingOrderIndexes.join(', ')}`,
          }),
        )
      }

      const resolvedContentTypes =
        uploadContentTypes === undefined
          ? orderIndexes.map(() => 'image/jpeg')
          : uploadContentTypes.map((raw: string) => normalizeUploadContentType(raw))

      const presignedUploadRequests: Array<{
        submissionState: (typeof submissionStates)[number]
        contentType: string
      }> = resolvedSubmissionStates.map(
        (submissionState: (typeof submissionStates)[number] | null, index: number) => ({
          submissionState: submissionState!,
          contentType: resolvedContentTypes[index]!,
        }),
      )

      return yield* Effect.forEach(
        presignedUploadRequests,
        ({ submissionState, contentType }) =>
          s3
            .getPresignedUrl(bucketName, submissionState.key, 'PUT', {
              contentType,
            })
            .pipe(
              Effect.map((url) => ({
                key: submissionState.key,
                url,
                contentType,
              })),
            ),
        { concurrency: 'unbounded' },
      )
    })

  const reTriggerUploadFlow: UploadFlowService['Service']['reTriggerUploadFlow'] = Effect.fn(
    'UploadFlowService.reTriggerUploadFlow',
  )(function* ({ domain, reference }) {
    const participantState = yield* kv.getParticipantState(domain, reference)
    if (Option.isNone(participantState)) {
      return yield* Effect.fail(
        new BadRequestError({
          message: `[${domain}|${reference}] Participant not initialized`,
        }),
      )
    }

    const submissionStates = yield* kv.getAllSubmissionStates(domain, reference, [
      ...participantState.value.orderIndexes,
    ])

    const submissionKeys = submissionStates.map((state) => state.key)

    yield* sqs.sendMessage(
      queueUrl,
      JSON.stringify({
        submissionKeys,
      }),
    )
  })

  return UploadFlowService.of({
    getPublicMarathon,
    checkParticipantExists,
    prepareUploadFlow,
    resolveByCameraParticipantByPhone,
    getUploadStatus,
    refreshPresignedUploads,
    reTriggerUploadFlow,
  })
})

export const UploadFlowServiceLayerNoDeps = Layer.effect(UploadFlowService, makeUploadFlowService)

export const UploadFlowServiceLayer = UploadFlowServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      DbLayer,
      S3ServiceLayer,
      SQSServiceLayer,
      UploadSessionRepositoryLayer,
      PhoneNumberEncryptionServiceLayer,
      RealtimeEventsServiceLayer,
      PublicMarathonCacheLayer,
    ),
  ),
)
