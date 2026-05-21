import { Array, Config, Context, Effect, Layer, Option, Order, pipe } from 'effect'
import {
  DbError,
  DbLayer,
  MarathonsRepository,
  ParticipantsRepository,
  SubmissionsRepository,
  type NewParticipant,
  type Participant,
  type Topic,
} from '@blikka/db'
import { S3ClientError, S3Service, S3ServiceLayer } from '@blikka/aws'
import {
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  type UploadSessionRepositoryError,
} from '@blikka/kv-store'

import type { InitializeUploadFlow } from './contracts'
import { createUploadSessionId } from './utils'
import {
  UploadProvisionerService,
  UploadProvisionerServiceLayer,
  type UploadProvisionerError,
} from './provision-upload'
import { ensureMarathonIsOpenForUploads } from './utils'
import { BadRequestError } from '../errors'
import {
  encryptOptionalPhoneNumber,
  ensureDeviceGroupExists,
  getCompetitionClassOrFail,
  isParticipantFinalized,
  maybeRecordParticipantTermsAcceptance,
  normalizeUploadContentType,
  staleOrderIndexesFromParticipantState,
} from '../shared/upload'
import {
  PhoneNumberEncryptionService,
  PhoneNumberEncryptionServiceLayer,
  type PhoneNumberEncryptionError,
} from '../utils/phone-number-encryption'
export type MarathonUploadInitializerError =
  | DbError
  | S3ClientError
  | PhoneNumberEncryptionError
  | BadRequestError
  | UploadSessionRepositoryError
  | UploadProvisionerError

export class MarathonUploadInitializerService extends Context.Service<
  MarathonUploadInitializerService,
  {
    readonly initializeUploadFlow: (input: InitializeUploadFlow) => Effect.Effect<
      {
        uploadSessionId: string
        reference: string
        uploads: { key: string; url: string; contentType: string }[]
      },
      MarathonUploadInitializerError
    >
  }
>()('@blikka/api/MarathonUploadInitializerService') {}

const makeMarathonUploadInitializerService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const submissionsRepository = yield* SubmissionsRepository
  const kv = yield* UploadSessionRepository
  const phoneEncryption = yield* PhoneNumberEncryptionService
  const s3 = yield* S3Service
  const bucketName = yield* Config.string('SUBMISSIONS_BUCKET_NAME')
  const uploadProvisioner = yield* UploadProvisionerService
  const initializeUploadFlow: MarathonUploadInitializerService['Service']['initializeUploadFlow'] =
    Effect.fn('MarathonUploadInitializerService.initializeUploadFlow')(function* ({
      domain,
      reference,
      firstname,
      lastname,
      email,
      competitionClassId,
      deviceGroupId,
      phoneNumber,
      uploadContentTypes,
      uploadExif,
      termsAccepted,
      acceptedLocale,
      termsAcceptanceSource,
    }: InitializeUploadFlow) {
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

      yield* ensureMarathonIsOpenForUploads({
        domain,
        marathon,
      })

      const competitionClass = yield* getCompetitionClassOrFail({
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

      const existingParticipantState = yield* kv.getParticipantState(domain, reference)
      const staleOrderIndexes = staleOrderIndexesFromParticipantState(existingParticipantState)

      const existingSubmissions = Option.match(existingParticipant, {
        onSome: (existing) => existing.submissions.map((submission) => submission.id),
        onNone: () => [] as number[],
      })

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
        status: 'initialized',
        phoneHash: hash,
        phoneEncrypted: encrypted,
      } satisfies NewParticipant

      const participant: Participant = yield* Option.match(existingParticipant, {
        onSome: (existing) => {
          if (isParticipantFinalized(existing.status)) {
            return Effect.fail(
              new BadRequestError({
                message: `[${domain}|${reference}] Participant already completed upload flow`,
              }),
            )
          }
          return participantsRepository.updateParticipantById({
            id: existing.id,
            data: participantData,
          })
        },
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
        source: termsAcceptanceSource === 'staff-on-behalf' ? 'staff-on-behalf' : 'participant',
      })

      const topics = pipe(
        marathon.topics,
        Array.sort(Order.mapInput(Order.Number, (topic: Topic) => topic.orderIndex)),
        Array.drop(competitionClass.topicStartIndex),
        Array.take(competitionClass.numberOfPhotos),
      )

      if (uploadContentTypes !== undefined && uploadContentTypes.length !== topics.length) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] uploadContentTypes length must match the number of submissions (${topics.length})`,
          }),
        )
      }

      if (uploadExif !== undefined && uploadExif.length !== topics.length) {
        return yield* Effect.fail(
          new BadRequestError({
            message: `[${domain}|${reference}] uploadExif length must match the number of submissions (${topics.length})`,
          }),
        )
      }

      const submissionKeys = yield* Effect.forEach(
        topics,
        (topic) => s3.generateSubmissionKey(domain, reference, topic.orderIndex),
        { concurrency: 'unbounded' },
      )

      if (existingSubmissions.length > 0) {
        yield* submissionsRepository.deleteMultipleSubmissions({
          ids: existingSubmissions,
        })
      }

      yield* submissionsRepository.createMultipleSubmissions({
        data: topics.map((topic, index) => ({
          participantId: participant.id,
          key: submissionKeys[index]!,
          marathonId: marathon.id,
          topicId: topic.id,
          status: 'initialized',
        })),
      })

      const uploadSessionId = createUploadSessionId()
      yield* kv.initializeState(domain, reference, uploadSessionId, submissionKeys)
      yield* uploadProvisioner.resetAndSeedUploadExif({
        domain,
        reference,
        staleOrderIndexes,
        orderIndexes: topics.map((topic) => topic.orderIndex),
        uploadExif,
      })

      const resolvedContentTypes =
        uploadContentTypes === undefined
          ? topics.map(() => 'image/jpeg')
          : uploadContentTypes.map((raw: string) => normalizeUploadContentType(raw))

      const presignedUrls = yield* Effect.forEach(
        submissionKeys.map((key, index) => ({
          key,
          contentType: resolvedContentTypes[index]!,
        })),
        ({ key, contentType }) => s3.getPresignedUrl(bucketName, key, 'PUT', { contentType }),
        { concurrency: 'unbounded' },
      )

      return {
        uploadSessionId,
        reference,
        uploads: submissionKeys.map((key, index) => ({
          key,
          url: presignedUrls[index]!,
          contentType: resolvedContentTypes[index]!,
        })),
      }
    })

  return MarathonUploadInitializerService.of({
    initializeUploadFlow,
  })
})

export const MarathonUploadInitializerServiceLayerNoDeps = Layer.effect(
  MarathonUploadInitializerService,
  makeMarathonUploadInitializerService,
)

export const MarathonUploadInitializerServiceLayer =
  MarathonUploadInitializerServiceLayerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        DbLayer,
        S3ServiceLayer,
        UploadSessionRepositoryLayer,
        PhoneNumberEncryptionServiceLayer,
        UploadProvisionerServiceLayer,
      ),
    ),
  )
