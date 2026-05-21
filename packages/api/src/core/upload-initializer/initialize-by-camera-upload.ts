import { Context, Effect, Layer, Option } from 'effect'
import {
  DbError,
  DbLayer,
  MarathonsRepository,
  ParticipantsRepository,
  SubmissionsRepository,
  type CompetitionClass,
  type NewParticipant,
  type Participant,
  type Topic,
} from '@blikka/db'
import {
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  type UploadSessionRepositoryError,
} from '@blikka/kv-store'

import type { InitializeByCameraUploadInput } from './contracts'
import {
  createRandomReference,
  ensureMarathonIsOpenForUploads,
  MAX_REFERENCE_GENERATION_ATTEMPTS,
} from './utils'
import {
  UploadProvisionerService,
  UploadProvisionerServiceLayer,
  type UploadProvisionerError,
} from './provision-upload'
import { BadRequestError } from '../errors'
import { getActiveByCameraTopicOrBadRequest, requireMarathonMode } from '../shared'
import {
  ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE,
  encryptOptionalPhoneNumber,
  ensureDeviceGroupExists,
  isParticipantFinalized,
  maybeRecordParticipantTermsAcceptance,
  normalizeUploadContentType,
  staleOrderIndexesFromParticipantState,
  type DeviceByCameraParticipantContext,
  type MarathonWithRelations,
} from '../shared/upload'
import {
  PhoneNumberEncryptionService,
  PhoneNumberEncryptionServiceLayer,
  type PhoneNumberEncryptionError,
} from '../utils/phone-number-encryption'

export type ByCameraUploadInitializerError =
  | DbError
  | PhoneNumberEncryptionError
  | BadRequestError
  | UploadSessionRepositoryError
  | UploadProvisionerError

type ByCameraUploadValidationScope =
  | { variant: 'device'; domain: string }
  | { variant: 'staff'; domain: string; reference: string }

type ByCameraVariantContext =
  | {
      variant: 'device'
      marathon: MarathonWithRelations
      activeTopic: Topic
      deviceContext: DeviceByCameraParticipantContext
      termsSource: 'participant'
    }
  | {
      variant: 'staff'
      marathon: MarathonWithRelations
      activeTopic: Topic
      termsSource: 'staff-on-behalf'
    }

type ResolvedByCameraParticipant = {
  participant: Participant
  reference: string
  staleOrderIndexes: readonly number[]
  activeTopicSubmissionIdToDelete: number | null
}

interface ByCameraParticipantUpdateParams {
  competitionClassId: number
  deviceGroupId: number
  firstname: string
  lastname: string
  email: string
  phoneHash: string
  phoneEncrypted: string
}

interface CreateByCameraParticipantWithGeneratedReferenceParams extends ByCameraParticipantUpdateParams {
  domain: string
  marathonId: number
}

type ByCameraParticipantUpdateBase = Omit<
  ByCameraParticipantUpdateParams,
  'phoneHash' | 'phoneEncrypted'
>

function getByCameraCompetitionClassIdOrFail({
  domain,
  marathon,
}: {
  domain: string
  marathon: { competitionClasses: CompetitionClass[] }
}): Effect.Effect<number, BadRequestError> {
  const competitionClass = marathon.competitionClasses.find(
    (resolvedCompetitionClass) => resolvedCompetitionClass.numberOfPhotos === 1,
  )

  if (!competitionClass) {
    return Effect.fail(
      new BadRequestError({
        message: `[${domain}] Competition class not found`,
      }),
    )
  }

  return Effect.succeed(competitionClass.id)
}

function scopeLabel(scope: ByCameraUploadValidationScope): string {
  if (scope.variant === 'device') {
    return `[${scope.domain}]`
  }
  const refLabel = scope.reference.trim() === '' ? 'new' : scope.reference
  return `[${scope.domain}|${refLabel}]`
}

function variantDescription(scope: ByCameraUploadValidationScope): string {
  return scope.variant === 'staff' ? 'by-camera staff upload' : 'by-camera upload'
}

function validateSingleByCameraUploadPayload(
  scope: ByCameraUploadValidationScope,
  {
    uploadContentTypes,
    uploadExif,
  }: {
    uploadContentTypes?: readonly string[] | undefined
    uploadExif?: ReadonlyArray<unknown> | undefined
  },
): Effect.Effect<void, BadRequestError> {
  const label = scopeLabel(scope)
  const description = variantDescription(scope)

  return Effect.gen(function* () {
    if (uploadExif !== undefined && uploadExif.length !== 1) {
      return yield* Effect.fail(
        new BadRequestError({
          message: `${label} uploadExif must contain exactly one entry for ${description}`,
        }),
      )
    }

    if (uploadContentTypes !== undefined && uploadContentTypes.length !== 1) {
      return yield* Effect.fail(
        new BadRequestError({
          message: `${label} uploadContentTypes must contain exactly one entry for ${description}`,
        }),
      )
    }
  })
}

function requireByCameraPhone(
  encrypted: string | null | undefined,
  hash: string | null | undefined,
  domain: string,
): Effect.Effect<{ encrypted: string; hash: string }, BadRequestError> {
  if (!encrypted || !hash) {
    return Effect.fail(
      new BadRequestError({
        message: `[${domain}] Phone number is required`,
      }),
    )
  }
  return Effect.succeed({ encrypted, hash })
}

function resolveSingleUploadContentType(uploadContentTypes: readonly string[] | undefined): string {
  return uploadContentTypes === undefined || uploadContentTypes.length === 0
    ? 'image/jpeg'
    : normalizeUploadContentType(uploadContentTypes[0])
}

function assertDeviceByCameraUploadAllowed({
  activeTopicUploadState,
  replaceExistingActiveTopicUpload,
}: {
  activeTopicUploadState: 'eligible' | 'already-uploaded'
  replaceExistingActiveTopicUpload?: boolean | undefined
}): Effect.Effect<void, BadRequestError> {
  if (activeTopicUploadState === 'already-uploaded' && !replaceExistingActiveTopicUpload) {
    return Effect.fail(
      new BadRequestError({
        message: ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE,
      }),
    )
  }

  return Effect.void
}

function buildByCameraParticipantUpdate({
  competitionClassId,
  deviceGroupId,
  firstname,
  lastname,
  email,
  phoneHash,
  phoneEncrypted,
}: ByCameraParticipantUpdateParams) {
  return {
    competitionClassId,
    deviceGroupId,
    firstname,
    lastname,
    email,
    participantMode: 'by-camera' as const,
    status: 'initialized' as const,
    phoneHash,
    phoneEncrypted,
  }
}

export class ByCameraUploadInitializerService extends Context.Service<
  ByCameraUploadInitializerService,
  {
    readonly initializeByCameraUpload: (input: InitializeByCameraUploadInput) => Effect.Effect<
      {
        participantId: number
        reference: string
        uploadSessionId: string
        uploads: { key: string; url: string; contentType: string }[]
      },
      ByCameraUploadInitializerError
    >
  }
>()('@blikka/api/ByCameraUploadInitializerService') {}

const makeByCameraUploadInitializerService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const submissionsRepository = yield* SubmissionsRepository
  const kv = yield* UploadSessionRepository
  const phoneEncryption = yield* PhoneNumberEncryptionService
  const uploadProvisioner = yield* UploadProvisionerService
  const getActiveTopicSubmissionOrNull = Effect.fn(
    'ByCameraUploadInitializerService.getActiveTopicSubmissionOrNull',
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

  const assertByCameraPhoneUniqueness = Effect.fn(
    'ByCameraUploadInitializerService.assertByCameraPhoneUniqueness',
  )(function* ({
    marathonId,
    phoneHash,
    excludeParticipantId,
  }: {
    marathonId: number
    phoneHash: string
    excludeParticipantId?: number | undefined
  }) {
    const otherWithPhone = yield* participantsRepository.getByPhoneHashForByCamera({
      marathonId,
      phoneHash,
    })

    if (Option.isSome(otherWithPhone) && otherWithPhone.value.id !== excludeParticipantId) {
      return yield* Effect.fail(
        new BadRequestError({
          message: 'Another participant already uses this phone number',
        }),
      )
    }
  })

  const hasSuccessfulActiveTopicUpload = Effect.fn(
    'ByCameraUploadInitializerService.hasSuccessfulActiveTopicUpload',
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
    if (submissionStatus && submissionStatus !== 'initialized') {
      return true
    }

    const participantState = yield* kv.getParticipantState(domain, reference)
    const submissionState = yield* kv.getSubmissionState(domain, reference, activeTopic.orderIndex)

    if (
      Option.isSome(participantState) &&
      participantState.value.finalized &&
      participantState.value.orderIndexes.includes(activeTopic.orderIndex)
    ) {
      return true
    }

    if (Option.isSome(submissionState)) {
      const state = submissionState.value
      return state.uploaded || state.exifProcessed || state.thumbnailKey !== null
    }

    return false
  })

  const loadByCameraMarathon = Effect.fn(
    'ByCameraUploadInitializerService.loadByCameraMarathon',
  )(function* ({
    domain,
    invalidModeMessage,
  }: {
    domain: string
    invalidModeMessage: string
  }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomainWithOptions({ domain })
      .pipe(
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

    yield* requireMarathonMode(marathon, 'by-camera', invalidModeMessage)

    const activeTopic = yield* getActiveByCameraTopicOrBadRequest({
      domain,
      topics: marathon.topics,
    })

    return { marathon, activeTopic }
  })

  const resolveExistingByCameraParticipant = Effect.fn(
    'ByCameraUploadInitializerService.resolveExistingByCameraParticipant',
  )(function* ({ domain, phoneNumber }: { domain: string; phoneNumber: string }) {
    const { marathon, activeTopic } = yield* loadByCameraMarathon({
      domain,
      invalidModeMessage: `[{domain}] Marathon is not in by-camera mode`,
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
    } satisfies DeviceByCameraParticipantContext
  })

  const resolveStaffByCameraParticipantByReference = Effect.fn(
    'ByCameraUploadInitializerService.resolveStaffByCameraParticipantByReference',
  )(function* ({
    domain,
    reference,
    phoneHash,
    marathon,
    activeTopic,
    replaceExistingActiveTopicUpload,
    replaceCompletedParticipantUpload,
  }: {
    domain: string
    reference: string
    phoneHash: string
    marathon: MarathonWithRelations
    activeTopic: Topic
    replaceExistingActiveTopicUpload?: boolean | undefined
    replaceCompletedParticipantUpload?: boolean | undefined
  }) {
    const allowReplaceCompleted = replaceCompletedParticipantUpload === true

    const existingParticipant = yield* participantsRepository.getParticipantByReference({
      reference,
      domain,
    })

    if (Option.isSome(existingParticipant)) {
      const row = existingParticipant.value

      if (isParticipantFinalized(row.status) && !allowReplaceCompleted) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] Participant already completed upload flow`,
          }),
        )
      }

      if (row.participantMode !== 'by-camera') {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] Participant is not in by-camera mode`,
          }),
        )
      }

      yield* assertByCameraPhoneUniqueness({
        marathonId: marathon.id,
        phoneHash,
        excludeParticipantId: row.id,
      })

      const activeTopicSubmission = yield* getActiveTopicSubmissionOrNull({
        participantId: row.id,
        topicId: activeTopic.id,
      })

      const alreadyUploaded = yield* hasSuccessfulActiveTopicUpload({
        domain,
        reference: row.reference,
        activeTopic,
        submissionStatus: activeTopicSubmission?.status ?? null,
      })

      if (alreadyUploaded && !replaceExistingActiveTopicUpload && !allowReplaceCompleted) {
        return yield* Effect.fail(
          new BadRequestError({
            message: ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE,
          }),
        )
      }

      return {
        existingParticipant: row,
        activeTopicSubmissionIdToDelete: activeTopicSubmission?.id ?? null,
      }
    }

    yield* assertByCameraPhoneUniqueness({
      marathonId: marathon.id,
      phoneHash,
    })

    return {
      existingParticipant: null,
      activeTopicSubmissionIdToDelete: null,
    }
  })

  const createByCameraParticipantWithGeneratedReference = Effect.fn(
    'ByCameraUploadInitializerService.createByCameraParticipantWithGeneratedReference',
  )(function* ({
    domain,
    marathonId,
    competitionClassId,
    deviceGroupId,
    firstname,
    lastname,
    email,
    phoneHash,
    phoneEncrypted,
  }: CreateByCameraParticipantWithGeneratedReferenceParams) {
    for (let attempt = 0; attempt < MAX_REFERENCE_GENERATION_ATTEMPTS; attempt += 1) {
      const reference = createRandomReference()
      const existingReference = yield* participantsRepository.getParticipantByReference({
        domain,
        reference,
      })

      if (Option.isSome(existingReference)) {
        continue
      }

      const participantData = {
        reference,
        domain,
        competitionClassId,
        deviceGroupId,
        marathonId,
        participantMode: 'by-camera',
        firstname,
        lastname,
        email,
        status: 'initialized',
        phoneHash,
        phoneEncrypted,
      } satisfies NewParticipant

      const created = yield* participantsRepository
        .createParticipant({ data: participantData })
        .pipe(
          Effect.map((participant) => ({ participant, reference })),
          Effect.catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            if (message.includes('participants_domain_reference_key')) {
              return Effect.succeed(null)
            }
            return Effect.fail(error)
          }),
        )

      if (created) {
        return created
      }
    }

    return yield* Effect.fail(
      new BadRequestError({
        message: `[${domain}] Failed to allocate a unique participant reference`,
      }),
    )
  })

  const upsertByCameraParticipant = Effect.fn(
    'ByCameraUploadInitializerService.upsertByCameraParticipant',
  )(function* ({
    domain,
    marathonId,
    participantUpdateBase,
    phoneHash,
    phoneEncrypted,
    existingParticipant,
  }: {
    domain: string
    marathonId: number
    participantUpdateBase: ByCameraParticipantUpdateBase
    phoneHash: string
    phoneEncrypted: string
    existingParticipant: Participant | null
  }) {
    if (existingParticipant) {
      const participant = yield* participantsRepository.updateParticipantById({
        id: existingParticipant.id,
        data: buildByCameraParticipantUpdate({
          ...participantUpdateBase,
          phoneHash,
          phoneEncrypted,
        }),
      })
      const existingParticipantState = yield* kv.getParticipantState(
        domain,
        existingParticipant.reference,
      )

      return {
        participant,
        reference: existingParticipant.reference,
        staleOrderIndexes: staleOrderIndexesFromParticipantState(existingParticipantState),
      }
    }

    const created = yield* createByCameraParticipantWithGeneratedReference({
      domain,
      marathonId,
      ...participantUpdateBase,
      phoneHash,
      phoneEncrypted,
    })

    return {
      participant: created.participant,
      reference: created.reference,
      staleOrderIndexes: [] as readonly number[],
    }
  })

  const resolveDeviceByCameraParticipant = Effect.fn(
    'ByCameraUploadInitializerService.resolveDeviceByCameraParticipant',
  )(function* ({
    domain,
    marathonId,
    participantUpdateBase,
    phoneHash,
    phoneEncrypted,
    deviceContext,
  }: {
    domain: string
    marathonId: number
    participantUpdateBase: ByCameraParticipantUpdateBase
    phoneHash: string
    phoneEncrypted: string
    deviceContext: DeviceByCameraParticipantContext
  }) {
    const upserted = yield* upsertByCameraParticipant({
      domain,
      marathonId,
      participantUpdateBase,
      phoneHash,
      phoneEncrypted,
      existingParticipant: deviceContext.existingParticipant,
    })

    return {
      ...upserted,
      activeTopicSubmissionIdToDelete: deviceContext.activeTopicSubmission?.id ?? null,
    } satisfies ResolvedByCameraParticipant
  })

  const initializeByCameraUpload: ByCameraUploadInitializerService['Service']['initializeByCameraUpload'] =
    Effect.fn('ByCameraUploadInitializerService.initializeByCameraUpload')(function* (
      input: InitializeByCameraUploadInput,
    ) {
      const variantContext: ByCameraVariantContext =
        input.variant === 'device'
          ? yield* resolveExistingByCameraParticipant({
              domain: input.domain,
              phoneNumber: input.phoneNumber,
            }).pipe(
              Effect.map((deviceContext) => ({
                variant: 'device' as const,
                marathon: deviceContext.marathon,
                activeTopic: deviceContext.activeTopic,
                deviceContext,
                termsSource: 'participant' as const,
              })),
            )
          : yield* loadByCameraMarathon({
              domain: input.domain,
              invalidModeMessage:
                '[{domain}] Staff by-camera upload is only available in by-camera mode',
            }).pipe(
              Effect.map(({ marathon, activeTopic }) => ({
                variant: 'staff' as const,
                marathon,
                activeTopic,
                termsSource: 'staff-on-behalf' as const,
              })),
            )

      const { marathon, activeTopic } = variantContext

      yield* ensureMarathonIsOpenForUploads({
        domain: input.domain,
        marathon,
        activeTopic,
      })

      yield* ensureDeviceGroupExists({
        domain: input.domain,
        marathon,
        deviceGroupId: input.deviceGroupId,
      })

      if (variantContext.variant === 'device') {
        yield* assertDeviceByCameraUploadAllowed({
          activeTopicUploadState: variantContext.deviceContext.activeTopicUploadState,
          replaceExistingActiveTopicUpload: input.replaceExistingActiveTopicUpload,
        })
      }

      const competitionClassId = yield* getByCameraCompetitionClassIdOrFail({
        domain: input.domain,
        marathon,
      })

      const { encrypted, hash } = yield* encryptOptionalPhoneNumber(
        phoneEncryption,
        input.phoneNumber,
      ).pipe(
        Effect.flatMap(({ encrypted: phoneEncrypted, hash: phoneHash }) =>
          requireByCameraPhone(phoneEncrypted, phoneHash, input.domain),
        ),
      )

      yield* validateSingleByCameraUploadPayload(
        input.variant === 'staff'
          ? { variant: 'staff', domain: input.domain, reference: input.reference }
          : { variant: 'device', domain: input.domain },
        {
          uploadContentTypes: input.uploadContentTypes,
          uploadExif: input.uploadExif,
        },
      )

      const participantUpdateBase = {
        competitionClassId,
        deviceGroupId: input.deviceGroupId,
        firstname: input.firstname,
        lastname: input.lastname,
        email: input.email,
      }

      let resolved: ResolvedByCameraParticipant
      if (input.variant === 'device' && variantContext.variant === 'device') {
        resolved = yield* resolveDeviceByCameraParticipant({
          domain: input.domain,
          marathonId: marathon.id,
          participantUpdateBase,
          phoneHash: hash,
          phoneEncrypted: encrypted,
          deviceContext: variantContext.deviceContext,
        })
      } else if (input.variant === 'staff' && variantContext.variant === 'staff') {
        const staffLookup = yield* resolveStaffByCameraParticipantByReference({
          domain: input.domain,
          reference: input.reference,
          phoneHash: hash,
          marathon,
          activeTopic,
          replaceExistingActiveTopicUpload: input.replaceExistingActiveTopicUpload,
          replaceCompletedParticipantUpload: input.replaceCompletedParticipantUpload,
        })

        const upserted = yield* upsertByCameraParticipant({
          domain: input.domain,
          marathonId: marathon.id,
          participantUpdateBase,
          phoneHash: hash,
          phoneEncrypted: encrypted,
          existingParticipant: staffLookup.existingParticipant,
        })

        resolved = {
          ...upserted,
          activeTopicSubmissionIdToDelete: staffLookup.activeTopicSubmissionIdToDelete,
        }
      } else {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${input.domain}] Unexpected by-camera upload variant`,
          }),
        )
      }

      yield* maybeRecordParticipantTermsAcceptance(participantsRepository, {
        participant: resolved.participant,
        marathon,
        domain: input.domain,
        termsAccepted: input.termsAccepted,
        acceptedLocale: input.acceptedLocale,
        source: variantContext.termsSource,
      })

      if (resolved.activeTopicSubmissionIdToDelete !== null) {
        yield* submissionsRepository.deleteSubmissionById({
          id: resolved.activeTopicSubmissionIdToDelete,
        })
      }

      return yield* uploadProvisioner.provisionSingleByCameraUpload({
        domain: input.domain,
        reference: resolved.reference,
        participantId: resolved.participant.id,
        marathonId: marathon.id,
        activeTopic,
        resolvedContentType: resolveSingleUploadContentType(input.uploadContentTypes),
        staleOrderIndexes: resolved.staleOrderIndexes,
        uploadExif: input.uploadExif,
      })
    })

  return ByCameraUploadInitializerService.of({
    initializeByCameraUpload,
  })
})

export const ByCameraUploadInitializerServiceLayerNoDeps = Layer.effect(
  ByCameraUploadInitializerService,
  makeByCameraUploadInitializerService,
)

export const ByCameraUploadInitializerServiceLayer =
  ByCameraUploadInitializerServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        DbLayer,
        UploadSessionRepositoryLayer,
        PhoneNumberEncryptionServiceLayer,
        UploadProvisionerServiceLayer,
      ),
    ),
  )
