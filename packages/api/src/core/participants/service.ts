import { Config, Effect, Layer, Option, Context } from 'effect'
import {
  DbLayer,
  ParticipantsRepository,
  MarathonsRepository,
  DbError,
  type InfiniteDomainParticipantRow,
  type InfiniteParticipantsPage,
  type NewParticipant,
  type Participant,
  type ParticipantWithTopicSubmissionsAndContactSheets,
  type ParticipantsBatchDeletionResult,
  type ParticipantsBatchIdsMutationResult,
} from '@blikka/db'
import {
  RealtimeEventsService,
  RealtimeEventsServiceLayer,
  type RealtimeError,
} from '@blikka/realtime'
import {
  type BatchDeleteInput,
  type BatchMarkCompletedInput,
  type BatchVerifyInput,
  type CreateParticipantInput,
  type GetByDomainInfiniteInput,
  type GetByReferenceInput,
  type GetPublicParticipantByReferenceInput,
  type PublicParticipant,
  type UpdateByCameraParticipantContactInput,
  type UpdateMarathonParticipantContactInput,
  type UpdateMarathonParticipantRegistrationInput,
  type VerifyParticipantInput,
} from './contracts'
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
  failNotFoundIfNone,
} from '../errors'
import { getRealtimeChannelEnvironmentFromNodeEnv } from '@blikka/realtime/contract'
import {
  EncryptedPhoneNumber,
  PhoneNumberEncryptionService,
  PhoneNumberEncryptionServiceLayer,
  type PhoneNumberEncryptionError,
} from '../utils/phone-number-encryption'
import { ensureDeviceGroupExists, getCompetitionClassOrFail } from '../shared/upload'

/**
 * Repo infinite-list row minus `phoneEncrypted`, with decrypted `phoneNumber` for admins;
 * excludes `phoneHash` at persistence (see repository query).
 */
interface InfiniteParticipantsDomainRowPublic extends Omit<
  InfiniteDomainParticipantRow,
  'phoneEncrypted'
> {
  phoneNumber: string | null
}

/**
 * Cursor page of {@link InfiniteParticipantsDomainRowPublic} plus `nextCursor`;
 * replaces ciphertext with a decrypted display phone at the API layer.
 */
interface InfiniteParticipantsPageWithDecryptPhoneNumbers extends Omit<
  InfiniteParticipantsPage,
  'participants'
> {
  participants: InfiniteParticipantsDomainRowPublic[]
}

/** Full participant + relations after decrypting `phoneEncrypted` into `phoneNumber` (dashboard / admin flows). */
interface ParticipantDetailWithDecryptPhone extends ParticipantWithTopicSubmissionsAndContactSheets {
  phoneNumber: string | null
}

export class ParticipantsService extends Context.Service<
  ParticipantsService,
  {
    /**
     * Returns a slim public view of a participant by `reference` and `domain` for client-facing flows;
     * topic titles are omitted when the topic is not public or active.
     */
    readonly getPublicParticipantByReference: (
      input: GetPublicParticipantByReferenceInput,
    ) => Effect.Effect<PublicParticipant, DbError | NotFoundError, never>

    /**
     * Cursor-paged participants for a marathon `domain`, with filters for search, class, topics, verification, votes, etc.;
     * rows omit stored phone secrets and expose a decrypted `phoneNumber` instead.
     */
    readonly getInfiniteParticipantsByDomain: (
      input: GetByDomainInfiniteInput,
    ) => Effect.Effect<InfiniteParticipantsPageWithDecryptPhoneNumbers, DbError, never>

    /**
     * Participant with submissions, zipped files, validations, contact sheets, and decrypted `phoneNumber`
     * for the given `reference` and `domain`, or fails if missing.
     */
    readonly getByReference: (
      input: GetByReferenceInput,
    ) => Effect.Effect<ParticipantDetailWithDecryptPhone, DbError | NotFoundError, never>

    /** Deletes the participant matched by `reference` and `domain` after verifying they exist. */
    readonly deleteByReference: (
      input: GetByReferenceInput,
    ) => Effect.Effect<Participant, DbError | NotFoundError, never>

    /**
     * Persists a new participant; optional `phoneNumber` is hashed and encrypted before insert.
     */
    readonly createParticipant: (
      input: CreateParticipantInput,
    ) => Effect.Effect<Participant, DbError | PhoneNumberEncryptionError, never>

    /** Deletes many participants by id, scoped to `domain`; returns how many succeeded and which ids failed. */
    readonly batchDelete: (
      input: BatchDeleteInput,
    ) => Effect.Effect<ParticipantsBatchDeletionResult, DbError, never>

    /**
     * Marks many participants verified for `domain`, emits realtime “participant-verified”;
     * skips failed ids without aborting the rest.
     */
    readonly batchVerify: (
      input: BatchVerifyInput,
    ) => Effect.Effect<ParticipantsBatchIdsMutationResult, DbError | RealtimeError, never>

    /** Completes multiple participants (`completed` path) scoped to `domain`; reports per-id failures. */
    readonly batchMarkCompleted: (
      input: BatchMarkCompletedInput,
    ) => Effect.Effect<ParticipantsBatchIdsMutationResult, DbError, never>

    /**
     * For by-camera marathons only: trims and validates contact fields, rejects duplicate phones for others,
     * then updates participant contact and phone ciphertext for `reference` on `domain`.
     */
    readonly updateByCameraParticipantContact: (
      input: UpdateByCameraParticipantContactInput,
    ) => Effect.Effect<
      undefined,
      | DbError
      | PhoneNumberEncryptionError
      | NotFoundError
      | BadRequestError
      | ConflictError
      | PreconditionFailedError,
      never
    >

    /**
     * For classic marathon mode only: updates name and email on the participant keyed by `reference` and `domain`.
     */
    readonly updateMarathonParticipantContact: (
      input: UpdateMarathonParticipantContactInput,
    ) => Effect.Effect<
      undefined,
      DbError | NotFoundError | BadRequestError | PreconditionFailedError,
      never
    >

    /**
     * For classic marathon mode only: updates the core registration details staff need before upload.
     */
    readonly updateMarathonParticipantRegistration: (
      input: UpdateMarathonParticipantRegistrationInput,
    ) => Effect.Effect<
      ParticipantDetailWithDecryptPhone,
      DbError | NotFoundError | BadRequestError | PreconditionFailedError,
      never
    >

    /**
     * Verifies a single participant by `id` within `domain` (delegates to `batchVerify` with one id);
     * notifies via realtime consistent with bulk verify.
     */
    readonly verifyParticipant: (
      input: VerifyParticipantInput,
    ) => Effect.Effect<ParticipantsBatchIdsMutationResult, DbError | RealtimeError, never>
  }
>()('@blikka/api/ParticipantsService') {}

const makeParticipantsService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const phoneEncryption = yield* PhoneNumberEncryptionService
  const realtimeEvents = yield* RealtimeEventsService
  const environment = getRealtimeChannelEnvironmentFromNodeEnv(
    yield* Config.string('NODE_ENV').pipe(Config.withDefault('development')),
  )
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const getPublicParticipantByReference: ParticipantsService['Service']['getPublicParticipantByReference'] =
    Effect.fn('ParticipantsService.getPublicParticipantByReference')(function* ({
      reference,
      domain,
    }) {
      const result = yield* participantsRepository.getParticipantByReference({
        reference,
        domain,
      })

      if (Option.isNone(result)) {
        return yield* Effect.fail(
          new NotFoundError({
            resource: 'Participant',
            identifier: { reference, domain },
          }),
        )
      }

      return {
        reference: result.value.reference,
        domain: result.value.domain,
        status: result.value.status,
        publicSubmissions: result.value.submissions.map((submission) => ({
          topic: {
            name:
              submission.topic.visibility === 'public' || submission.topic.visibility === 'active'
                ? submission.topic.name
                : '',
            orderIndex: submission.topic.orderIndex,
          },
          status: submission.status,
          createdAt: submission.createdAt,
          key: submission.key,
          thumbnailKey: submission.thumbnailKey,
        })),
        competitionClass: {
          name: result.value.competitionClass?.name ?? '',
          description: result.value.competitionClass?.description ?? '',
        },
        deviceGroup: {
          name: result.value.deviceGroup?.name ?? '',
          description: result.value.deviceGroup?.description ?? '',
          icon: result.value.deviceGroup?.icon ?? '',
        },
      }
    })

  const getInfiniteParticipantsByDomain: ParticipantsService['Service']['getInfiniteParticipantsByDomain'] =
    Effect.fn('ParticipantsService.getInfiniteParticipantsByDomain')(function* ({
      domain,
      cursor,
      limit,
      search,
      sortOrder,
      competitionClassId,
      deviceGroupId,
      topicId,
      statusFilter,
      excludeStatuses,
      includeStatuses,
      hasValidationErrors,
      votedFilter,
    }) {
      const page = yield* participantsRepository.getInfiniteParticipantsByDomain({
        domain,
        cursor: cursor ?? undefined,
        limit: limit ?? undefined,
        search: search ?? undefined,
        sortOrder: sortOrder ?? undefined,
        competitionClassId: competitionClassId ?? undefined,
        deviceGroupId: deviceGroupId ?? undefined,
        topicId: topicId ?? undefined,
        statusFilter: statusFilter ?? undefined,
        excludeStatuses: excludeStatuses == null ? undefined : [...excludeStatuses],
        includeStatuses: includeStatuses == null ? undefined : [...includeStatuses],
        hasValidationErrors: hasValidationErrors ?? undefined,
        votedFilter: votedFilter ?? undefined,
      })

      const participantsWithPhone = yield* Effect.forEach(
        page.participants,
        (participant) =>
          Effect.gen(function* () {
            const { phoneEncrypted, ...rest } = participant
            const phoneNumber = yield* Option.match(Option.fromNullishOr(phoneEncrypted), {
              onNone: () => Effect.succeed<string | null>(null),
              onSome: (encrypted) =>
                phoneEncryption
                  .decrypt({
                    encrypted: encrypted as EncryptedPhoneNumber,
                  })
                  .pipe(Effect.catch(() => Effect.succeed<string | null>(null))),
            })
            return { ...rest, phoneNumber }
          }),
        { concurrency: 8 },
      )

      return {
        participants: participantsWithPhone,
        nextCursor: page.nextCursor,
      }
    })

  const getByReference: ParticipantsService['Service']['getByReference'] = Effect.fn(
    'ParticipantsService.getByReference',
  )(function* ({ reference, domain }) {
    const result = yield* participantsRepository.getParticipantByReference({
      reference,
      domain,
    })

    if (Option.isNone(result)) {
      return yield* Effect.fail(
        new NotFoundError({
          resource: 'Participant',
          identifier: { reference, domain },
        }),
      )
    }
    const row = result.value
    const phoneNumber = yield* Option.match(Option.fromNullishOr(row.phoneEncrypted), {
      onNone: () => Effect.succeed<string | null>(null),
      onSome: (encrypted) =>
        phoneEncryption
          .decrypt({
            encrypted: encrypted as EncryptedPhoneNumber,
          })
          .pipe(Effect.catch(() => Effect.succeed<string | null>(null))),
    })
    return { ...row, phoneNumber }
  })

  const deleteByReference: ParticipantsService['Service']['deleteByReference'] = Effect.fn(
    'ParticipantsService.deleteByReference',
  )(function* ({ reference, domain }) {
    const participant = yield* getByReference({ reference, domain })
    return yield* participantsRepository.deleteParticipant({
      id: participant.id,
    })
  })

  const createParticipant: ParticipantsService['Service']['createParticipant'] = Effect.fn(
    'ParticipantsService.createParticipant',
  )(function* ({ data, phoneNumber }) {
    let participantData: NewParticipant = {
      ...data,
      phoneHash: null,
      phoneEncrypted: null,
    }

    // If a phone number is provided, encrypt it and store both hash and encrypted value
    if (phoneNumber) {
      const { hash, encrypted } = yield* phoneEncryption.encrypt({
        phoneNumber,
      })
      participantData = {
        ...participantData,
        phoneHash: hash,
        phoneEncrypted: encrypted,
      }
    }

    const result = yield* participantsRepository.createParticipant({
      data: participantData,
    })

    return result
  })

  const batchDelete: ParticipantsService['Service']['batchDelete'] = Effect.fn(
    'ParticipantsService.batchDelete',
  )(function* ({ ids, domain }) {
    return yield* participantsRepository.batchDeleteParticipants({
      ids: [...ids],
      domain,
    })
  })

  const batchVerify: ParticipantsService['Service']['batchVerify'] = Effect.fn(
    'ParticipantsService.batchVerify',
  )(function* ({ ids, domain }) {
    const result = yield* participantsRepository.batchVerifyParticipants({
      ids: [...ids],
      domain,
    })

    yield* Effect.forEach(
      ids,
      (id) =>
        Effect.gen(function* () {
          if (result.failedIds.includes(id)) {
            return
          }

          const participant = yield* participantsRepository.getParticipantById({
            id,
          })
          if (Option.isNone(participant)) {
            return
          }

          yield* realtimeEvents.emitEventResult({
            environment,
            domain,
            reference: participant.value.reference,
            eventKey: 'participant-verified',
            outcome: 'success',
            timestamp: Date.now(),
            channels: 'participant',
          })
        }),
      { concurrency: 10, discard: true },
    )

    return result
  })

  const batchMarkCompleted: ParticipantsService['Service']['batchMarkCompleted'] = Effect.fn(
    'ParticipantsService.batchMarkCompleted',
  )(function* ({ ids, domain }) {
    return yield* participantsRepository.batchMarkParticipantsCompleted({
      ids: [...ids],
      domain,
    })
  })

  const updateByCameraParticipantContact: ParticipantsService['Service']['updateByCameraParticipantContact'] =
    Effect.fn('ParticipantsService.updateByCameraParticipantContact')(function* ({
      domain,
      reference,
      firstname,
      lastname,
      email,
      phone,
    }) {
      const first = firstname.trim()
      const last = lastname.trim()
      const mail = email.trim()
      const phoneTrimmed = phone.trim()

      if (!first || !last || !mail || !phoneTrimmed) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'First name, last name, email, and phone are required',
          }),
        )
      }

      const marathon = yield* marathonsRepository
        .getMarathonByDomain({ domain })
        .pipe(failNotFoundIfNone('Marathon', { domain }))
      if (marathon.mode !== 'by-camera') {
        return yield* Effect.fail(
          new PreconditionFailedError({
            message: 'Marathon is not in by-camera mode',
          }),
        )
      }

      const participant = yield* participantsRepository
        .getParticipantByReference({ reference, domain })
        .pipe(failNotFoundIfNone('Participant', { reference, domain }))
      if (participant.participantMode !== 'by-camera') {
        return yield* Effect.fail(
          new PreconditionFailedError({
            message: 'Only by-camera participants can be updated with this action',
          }),
        )
      }

      const phoneHash = yield* phoneEncryption.hashLookup({
        phoneNumber: phoneTrimmed,
      })
      const existingByPhone = yield* participantsRepository.getByPhoneHashForByCamera({
        marathonId: marathon.id,
        phoneHash,
      })
      if (Option.isSome(existingByPhone) && existingByPhone.value.id !== participant.id) {
        return yield* Effect.fail(
          new ConflictError({
            message: 'Another participant already uses this phone number',
          }),
        )
      }

      const { hash, encrypted } = yield* phoneEncryption.encrypt({
        phoneNumber: phoneTrimmed,
      })

      yield* participantsRepository.updateParticipantById({
        id: participant.id,
        data: {
          firstname: first,
          lastname: last,
          email: mail,
          phoneHash: hash,
          phoneEncrypted: encrypted,
          updatedAt: new Date().toISOString(),
        },
      })
    })

  const updateMarathonParticipantContact: ParticipantsService['Service']['updateMarathonParticipantContact'] =
    Effect.fn('ParticipantsService.updateMarathonParticipantContact')(function* ({
      domain,
      reference,
      firstname,
      lastname,
      email,
    }) {
      const first = firstname.trim()
      const last = lastname.trim()
      const mail = email.trim()

      if (!first || !last || !mail) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'First name, last name, and email are required',
          }),
        )
      }

      const marathon = yield* marathonsRepository
        .getMarathonByDomain({ domain })
        .pipe(failNotFoundIfNone('Marathon', { domain }))
      if (marathon.mode !== 'marathon') {
        return yield* Effect.fail(
          new PreconditionFailedError({
            message: 'Marathon is not in classic marathon mode',
          }),
        )
      }

      const participant = yield* participantsRepository
        .getParticipantByReference({ reference, domain })
        .pipe(failNotFoundIfNone('Participant', { reference, domain }))
      if (participant.participantMode !== 'marathon') {
        return yield* Effect.fail(
          new PreconditionFailedError({
            message: 'Only classic marathon participants can be updated with this action',
          }),
        )
      }

      yield* participantsRepository.updateParticipantById({
        id: participant.id,
        data: {
          firstname: first,
          lastname: last,
          email: mail,
          updatedAt: new Date().toISOString(),
        },
      })
    })

  const updateMarathonParticipantRegistration: ParticipantsService['Service']['updateMarathonParticipantRegistration'] =
    Effect.fn('ParticipantsService.updateMarathonParticipantRegistration')(function* ({
      domain,
      reference,
      firstname,
      lastname,
      email,
      competitionClassId,
      deviceGroupId,
    }) {
      const first = firstname.trim()
      const last = lastname.trim()
      const mail = email.trim()

      if (!first || !last || !mail) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'First name, last name, and email are required',
          }),
        )
      }

      if (!emailPattern.test(mail)) {
        return yield* Effect.fail(
          new BadRequestError({
            message: 'Enter a valid email address',
          }),
        )
      }

      const marathon = yield* marathonsRepository
        .getMarathonByDomainWithOptions({ domain })
        .pipe(failNotFoundIfNone('Marathon', { domain }))
      if (marathon.mode !== 'marathon') {
        return yield* Effect.fail(
          new PreconditionFailedError({
            message: 'Marathon is not in classic marathon mode',
          }),
        )
      }

      const participant = yield* participantsRepository
        .getParticipantByReference({ reference, domain })
        .pipe(failNotFoundIfNone('Participant', { reference, domain }))
      if (participant.participantMode !== 'marathon') {
        return yield* Effect.fail(
          new PreconditionFailedError({
            message: 'Only classic marathon participants can be updated with this action',
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

      yield* participantsRepository.updateParticipantById({
        id: participant.id,
        data: {
          firstname: first,
          lastname: last,
          email: mail,
          competitionClassId,
          deviceGroupId,
          updatedAt: new Date().toISOString(),
        },
      })

      return yield* getByReference({ reference, domain })
    })

  const verifyParticipant: ParticipantsService['Service']['verifyParticipant'] = Effect.fn(
    'ParticipantsService.verifyParticipant',
  )(function* ({ id, domain }) {
    const result = yield* participantsRepository.batchVerifyParticipants({
      ids: [id],
      domain,
    })

    if (result.updatedCount > 0) {
      const participant = yield* participantsRepository.getParticipantById({
        id,
      })

      if (Option.isSome(participant)) {
        yield* realtimeEvents.emitEventResult({
          environment,
          domain,
          reference: participant.value.reference,
          eventKey: 'participant-verified',
          outcome: 'success',
          timestamp: Date.now(),
          channels: 'participant',
        })
      }
    }

    return result
  })

  return ParticipantsService.of({
    getPublicParticipantByReference,
    getInfiniteParticipantsByDomain,
    getByReference,
    deleteByReference,
    createParticipant,
    batchDelete,
    batchVerify,
    batchMarkCompleted,
    updateByCameraParticipantContact,
    updateMarathonParticipantContact,
    updateMarathonParticipantRegistration,
    verifyParticipant,
  })
})

export const ParticipantsServiceLayerNoDeps = Layer.effect(
  ParticipantsService,
  makeParticipantsService,
)

export const ParticipantsServiceLayer = ParticipantsServiceLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(DbLayer, RealtimeEventsServiceLayer, PhoneNumberEncryptionServiceLayer),
  ),
)
