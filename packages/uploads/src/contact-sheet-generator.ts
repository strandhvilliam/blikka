import { Context, DateTime, Effect, Layer, Option, Schema } from 'effect'
import {
  DbLayer,
  ContactSheetsRepository,
  MarathonsRepository,
  ParticipantsRepository,
  TopicsRepository,
  SponsorsRepository,
  type DbError,
} from '@blikka/db'
import type { ContactSheetFormat } from '@blikka/image-manipulation'
import type { CompetitionClass } from '@blikka/db'
import { S3ClientError, S3Service, S3ServiceLayer } from '@blikka/aws'
import {
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  type ParticipantState,
  type UploadSessionRepositoryError,
} from '@blikka/kv-store'
import { ContactSheetBuilder, ContactSheetBuilderLayer } from '@blikka/image-manipulation'
import { UploadsConfig, UploadsConfigLayer } from './config'

export class InvalidSheetGenerationDataError extends Schema.TaggedErrorClass<InvalidSheetGenerationDataError>()(
  'InvalidSheetGenerationDataError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class FailedToGenerateContactSheetError extends Schema.TaggedErrorClass<FailedToGenerateContactSheetError>()(
  'FailedToGenerateContactSheetError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type ContactSheetGeneratorError =
  | InvalidSheetGenerationDataError
  | FailedToGenerateContactSheetError
  | UploadSessionRepositoryError
  | S3ClientError
  | DbError

export interface GenerateContactSheetInput {
  domain: string
  reference: string
  uploadSessionId: string
}

type ContactSheetSkipDecision =
  | {
      readonly shouldSkip: true
      readonly message: string
    }
  | {
      readonly shouldSkip: false
    }

export class ContactSheetGenerator extends Context.Service<
  ContactSheetGenerator,
  {
    /**
     * Generates a participant's contact sheet and saves it to S3 and the key to the database.
     * Will skip if the participant has already generated a contact sheet or is a single-photo participant (by-camera).
     * Current valid photo counts are 8 and 24.
     */
    readonly generate: (
      params: GenerateContactSheetInput,
    ) => Effect.Effect<void, ContactSheetGeneratorError>
  }
>()('@blikka/uploads/ContactSheetGenerator') {}

const VALID_PHOTO_COUNTS = [8, 24]
const VALID_CONTACT_SHEET_FORMATS = ['classic', 'a3'] as const

function toContactSheetFormat(value: string): ContactSheetFormat {
  if (VALID_CONTACT_SHEET_FORMATS.includes(value as (typeof VALID_CONTACT_SHEET_FORMATS)[number])) {
    return value as ContactSheetFormat
  }

  return 'classic'
}

function createContactSheetKey(domain: string, reference: string, timestamp: string) {
  return `${domain}/${reference}/contact_sheet_${reference}_${timestamp.replace(/[:.]/g, '-').slice(0, -5)}.jpg`
}

function isSupportedContactSheetPhotoCount(photoCount: number) {
  return VALID_PHOTO_COUNTS.includes(photoCount)
}

function shouldSkipGeneration(
  kvData: ParticipantState,
  uploadSessionId: string,
): ContactSheetSkipDecision {
  if (kvData.uploadSessionId !== uploadSessionId) {
    return {
      shouldSkip: true,
      message: 'Dropping contact sheet event for non-current upload session',
    }
  }

  if (kvData.contactSheetKey) {
    return {
      shouldSkip: true,
      message: 'Contact sheet already generated, skipping',
    }
  }

  if (kvData.expectedCount === 1) {
    return {
      shouldSkip: true,
      message: 'Single-photo participant, skipping contact sheet generation',
    }
  }

  return { shouldSkip: false }
}

const makeContactSheetGenerator = Effect.gen(function* () {
  const sponsorsRepository = yield* SponsorsRepository
  const topicsRepository = yield* TopicsRepository
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const contactSheetsRepository = yield* ContactSheetsRepository
  const kvStore = yield* UploadSessionRepository
  const s3 = yield* S3Service
  const config = yield* UploadsConfig
  const contactSheetBuilder = yield* ContactSheetBuilder

  const validatePhotoCount = Effect.fnUntraced(function* (
    reference: string,
    keys: string[],
    competitionClass: CompetitionClass | null,
  ) {
    if (!competitionClass?.numberOfPhotos) {
      return yield* new InvalidSheetGenerationDataError({
        message: 'Missing competition class photo count',
      })
    }

    const expectedCount = competitionClass.numberOfPhotos
    if (!isSupportedContactSheetPhotoCount(expectedCount)) {
      return yield* new InvalidSheetGenerationDataError({
        message: `Unsupported photo count ${expectedCount} for participant ${reference}`,
      })
    }

    if (keys.length !== expectedCount) {
      return yield* new InvalidSheetGenerationDataError({
        message: `Photo count mismatch. Expected ${expectedCount}, got ${keys.length}`,
      })
    }
  })

  const getSubmissionFiles = Effect.fn('ContactSheetGenerator.getSubmissionFiles')(function* (
    submissions: ReadonlyArray<{ key: string }>,
  ) {
    return yield* Effect.forEach(
      submissions,
      (submission, index) =>
        Effect.gen(function* () {
          const file = yield* s3.getFile(config.submissionsBucketName, submission.key)
          if (Option.isNone(file)) {
            return yield* new InvalidSheetGenerationDataError({
              message: `Submission image not found: ${submission.key}`,
            })
          }

          return {
            orderIndex: index,
            buffer: file.value,
          }
        }),
      { concurrency: 5 },
    )
  })

  const getSponsorImage = Effect.fn('ContactSheetGenerator.getSponsorImage')(function* (
    sponsorKey: string | undefined,
  ) {
    if (!sponsorKey) {
      return undefined
    }

    const file = yield* s3.getFile(config.sponsorsBucketName, sponsorKey)
    if (Option.isNone(file)) {
      return yield* new InvalidSheetGenerationDataError({
        message: `Sponsor image not found: ${sponsorKey}`,
      })
    }

    return file.value
  })

  const generate = Effect.fn('ContactSheetGenerator.generate')(
    function* (params: GenerateContactSheetInput) {
      const { domain, reference, uploadSessionId } = params

      const participantStateOpt = yield* kvStore.getParticipantState(domain, reference)
      if (Option.isNone(participantStateOpt)) {
        return yield* new InvalidSheetGenerationDataError({
          message: 'Participant state not found',
        })
      }
      const participantState = participantStateOpt.value

      const skipDecision = shouldSkipGeneration(participantState, uploadSessionId)
      if (skipDecision.shouldSkip) {
        yield* Effect.logWarning(skipDecision.message)
        return
      }

      const participantOpt = yield* participantsRepository.getParticipantByReference({
        reference,
        domain,
      })
      if (Option.isNone(participantOpt)) {
        return yield* new InvalidSheetGenerationDataError({
          message: 'Participant not found',
        })
      }
      const participant = participantOpt.value

      const [sponsor, topics, marathonOpt] = yield* Effect.all(
        [
          sponsorsRepository.getLatestSponsorByType({
            marathonId: participant.marathonId,
            type: 'contact-sheets',
          }),
          topicsRepository.getTopicsByDomain({ domain }),
          marathonsRepository.getMarathonByDomain({ domain }),
        ],
        { concurrency: 3 },
      )

      if (Option.isNone(marathonOpt)) {
        return yield* new InvalidSheetGenerationDataError({
          message: 'Marathon not found',
        })
      }

      const contactSheetFormat = toContactSheetFormat(marathonOpt.value.contactSheetFormat)

      const keys = participant.submissions.map((submission) => submission.key)
      yield* validatePhotoCount(reference, keys, participant.competitionClass)

      const images = yield* getSubmissionFiles(participant.submissions)
      const sponsorImage = yield* getSponsorImage(
        Option.isSome(sponsor) ? sponsor.value.key : undefined,
      )

      const timestamp = DateTime.formatIso(yield* DateTime.now)
      const contactSheetKey = createContactSheetKey(domain, reference, timestamp)

      const buffer = yield* contactSheetBuilder
        .createSheet({
          reference,
          images,
          sponsorImage,
          sponsorPosition: 'bottom-right',
          topics,
          format: contactSheetFormat,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new FailedToGenerateContactSheetError({
                message: `Failed to generate contact sheet: ${error.message}`,
                cause: error,
              }),
          ),
        )

      yield* s3.putFile(config.contactSheetsBucketName, contactSheetKey, buffer)
      yield* kvStore.updateParticipantSession(domain, reference, {
        contactSheetKey,
      })
      yield* contactSheetsRepository.save({
        data: {
          key: contactSheetKey,
          participantId: participant.id,
          marathonId: participant.marathonId,
        },
      })
    },
    (effect, params) => Effect.annotateLogs(effect, { ...params }),
  )

  return ContactSheetGenerator.of({ generate })
})

export const ContactSheetGeneratorLayerNoDeps = Layer.effect(
  ContactSheetGenerator,
  makeContactSheetGenerator,
)

export const ContactSheetGeneratorLayer = ContactSheetGeneratorLayerNoDeps.pipe(
  Layer.provide(
    Layer.mergeAll(
      DbLayer,
      UploadSessionRepositoryLayer,
      S3ServiceLayer,
      UploadsConfigLayer,
      ContactSheetBuilderLayer,
    ),
  ),
)
