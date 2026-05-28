import {
  ContactSheetBuilder,
  ContactSheetBuilderLayer,
  type ContactSheetError,
  type ContactSheetFormat,
} from '@blikka/image-manipulation'
import { Config, Effect, Layer, Option, Context } from 'effect'
import {
  DbLayer,
  ContactSheetsRepository,
  MarathonsRepository,
  ParticipantsRepository,
  TopicsRepository,
  SponsorsRepository,
  DbError,
  type CompetitionClass,
} from '@blikka/db'
import { S3Service, S3ServiceLayer, type S3ClientError } from '@blikka/aws'
import { BadRequestError, NotFoundError, failNotFoundIfNone } from '../errors'
import type { GenerateContactSheet } from './contracts'

const VALID_PHOTO_COUNTS = [8, 24]
const VALID_CONTACT_SHEET_FORMATS = ['classic', 'a3'] as const

function toContactSheetFormat(value: string): ContactSheetFormat {
  if (VALID_CONTACT_SHEET_FORMATS.includes(value as (typeof VALID_CONTACT_SHEET_FORMATS)[number])) {
    return value as ContactSheetFormat
  }

  return 'classic'
}

export class ContactSheetsService extends Context.Service<
  ContactSheetsService,
  {
    /**
     * Builds a contact sheet image from the participant’s submissions, uploads it to the contact-sheets
     * bucket, and persists a row pointing at the generated key.
     */
    readonly generateContactSheet: (
      input: GenerateContactSheet,
    ) => Effect.Effect<
      { success: boolean; key: string },
      DbError | BadRequestError | NotFoundError | S3ClientError | ContactSheetError,
      never
    >
  }
>()('@blikka/api/contact-sheets-api-service') {}

const makeContactSheetsService = Effect.gen(function* () {
  const sponsorsRepository = yield* SponsorsRepository
  const topicsRepository = yield* TopicsRepository
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const contactSheetsRepository = yield* ContactSheetsRepository
  const s3 = yield* S3Service
  const contactSheetBuilder = yield* ContactSheetBuilder
  const contactSheetsBucketName = yield* Config.string('CONTACT_SHEETS_BUCKET_NAME')
  const submissionsBucketName = yield* Config.string('SUBMISSIONS_BUCKET_NAME')
  const sponsorsBucketName = yield* Config.string('SPONSORS_BUCKET_NAME')

  const generateContactSheetKey = (domain: string, reference: string) =>
    `${domain}/${reference}/contact_sheet_${reference}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.jpg`

  const validatePhotoCount = Effect.fn('ContactSheetsService.validatePhotoCount')(function* (
    reference: string,
    domain: string,
    keys: string[],
    competitionClass: CompetitionClass | null,
  ) {
    if (!competitionClass?.numberOfPhotos) {
      return yield* Effect.fail(
        new BadRequestError({
          message: `[${reference}|${domain}] Missing competition class photo count`,
        }),
      )
    }

    const expectedCount = competitionClass.numberOfPhotos
    if (!VALID_PHOTO_COUNTS.includes(expectedCount)) {
      return yield* Effect.fail(
        new BadRequestError({
          message: `[${reference}|${domain}] Unsupported photo count ${expectedCount} for participant ${reference}`,
        }),
      )
    }

    if (keys.length !== expectedCount) {
      return yield* Effect.fail(
        new BadRequestError({
          message: `[${reference}|${domain}] Photo count mismatch. Expected ${expectedCount}, got ${keys.length}`,
        }),
      )
    }
  })

  const generateContactSheet: ContactSheetsService['Service']['generateContactSheet'] = Effect.fn(
    'ContactSheetsService.generateContactSheet',
  )(function* ({ domain, reference }) {
    const participantRow = yield* participantsRepository
      .getParticipantByReference({ reference, domain })
      .pipe(failNotFoundIfNone('Participant', { reference, domain }))

    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    const contactSheetFormat = toContactSheetFormat(marathon.contactSheetFormat)

    const submissions = participantRow.submissions || []
    if (submissions.length === 0) {
      return yield* Effect.fail(
        new BadRequestError({
          message: 'Participant has no submissions',
        }),
      )
    }

    yield* validatePhotoCount(
      reference,
      domain,
      submissions.map((s) => s.key),
      participantRow.competitionClass,
    )

    const sponsor = yield* sponsorsRepository.getLatestSponsorByType({
      marathonId: participantRow.marathonId,
      type: 'contact-sheets',
    })

    const topics = yield* topicsRepository
      .getTopicsByDomain({
        domain,
      })
      .pipe(
        Effect.map((topics) =>
          topics.flatMap((t) => ({
            name: t.name,
            orderIndex: t.orderIndex,
          })),
        ),
      )

    const images = yield* Effect.forEach(
      submissions,
      (submission, index) =>
        s3.getFile(submissionsBucketName, submission.key).pipe(
          failNotFoundIfNone('SubmissionImage', { key: submission.key }),
          Effect.map((buffer) => ({ orderIndex: index, buffer })),
        ),
      { concurrency: 5 },
    )

    const sponsorImage = Option.isSome(sponsor)
      ? yield* s3
          .getFile(sponsorsBucketName, sponsor.value.key)
          .pipe(failNotFoundIfNone('SponsorImage', { key: sponsor.value.key }))
      : undefined

    const contactSheetKey = generateContactSheetKey(domain, reference)

    const contactSheetBuffer = yield* contactSheetBuilder.createSheet({
      reference,
      images,
      sponsorImage,
      sponsorPosition: 'bottom-right',
      topics,
      format: contactSheetFormat,
    })

    yield* s3.putFile(contactSheetsBucketName, contactSheetKey, contactSheetBuffer)

    yield* contactSheetsRepository.save({
      data: {
        key: contactSheetKey,
        participantId: participantRow.id,
        marathonId: participantRow.marathonId,
      },
    })

    return {
      success: true,
      key: contactSheetKey,
    }
  })

  return ContactSheetsService.of({
    generateContactSheet,
  })
})

export const ContactSheetsServiceLayerNoDeps = Layer.effect(
  ContactSheetsService,
  makeContactSheetsService,
)

export const ContactSheetsServiceLayer = ContactSheetsServiceLayerNoDeps.pipe(
  Layer.provide(Layer.mergeAll(DbLayer, S3ServiceLayer, ContactSheetBuilderLayer)),
)
