import { Array, Config, Context, Effect, Layer, Option, Order, pipe } from "effect"
import { randomUUID } from "node:crypto"
import {
  DbError,
  DbLayer,
  MarathonsRepository,
  ParticipantsRepository,
  SubmissionsRepository,
  type CompetitionClass,
  type Marathon,
  type NewParticipant,
  type Participant,
  type Topic,
} from "@blikka/db"
import {
  S3ClientError,
  S3Service,
  S3ServiceLayer,
  SQSService,
  SQSServiceError,
  SQSServiceLayer,
} from "@blikka/aws"
import {
  ExifKVRepository,
  ExifKVRepositoryError,
  ExifKVRepositoryLayer,
  type InvalidKeyFormatError,
  UploadSessionRepository,
  UploadSessionRepositoryLayer,
  type UploadSessionRepositoryError,
} from "@blikka/kv-store"
import { RealtimeEventsService, RealtimeEventsServiceLayer } from "@blikka/realtime"
import {
  normalizeUploadContentType,
  type CheckParticipantExists,
  type GetPublicMarathon,
  type GetUploadStatus,
  type InitializeByCameraUpload,
  type InitializeStaffByCameraUpload,
  type InitializeUploadFlow,
  type PrepareUploadFlow,
  type RefreshPresignedUploads,
  type ResolveByCameraParticipantByPhone,
  type ReTriggerUploadFlow,
} from "./contracts"
import { UploadFlowApiError } from "./errors"
import {
  PhoneNumberEncryptionService,
  PhoneNumberEncryptionServiceLayer,
  type PhoneNumberEncryptionError,
} from "../utils/phone-number-encryption"

const ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE =
  "You have already uploaded a photo for the current topic."

const MAX_REFERENCE_GENERATION_ATTEMPTS = 25

const PLATFORM_TERMS_VERSION = "blikka-terms-2026-05-01"

function createRandomReference() {
  return Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")
}

function createUploadSessionId() {
  return randomUUID()
}

function normalizeOptionalPhoneNumber(phoneNumber?: string | null) {
  const normalizedPhoneNumber = phoneNumber?.trim()

  return normalizedPhoneNumber ? normalizedPhoneNumber : null
}

function normalizeAcceptedLocale(locale?: string | null) {
  const normalizedLocale = locale?.trim()

  return normalizedLocale ? normalizedLocale : null
}

function isParticipantFinalized(status: Participant["status"]) {
  return status === "completed" || status === "verified"
}

function hasExifFields(
  exif: Record<string, unknown> | null | undefined,
): exif is Record<string, unknown> {
  return exif !== null && exif !== undefined && Object.keys(exif).length > 0
}

/** Marathon row with `topics` replaced for public upload entry (redaction / by-camera slice). */
type PublicMarathonForClient = Omit<Marathon, "topics"> & { topics: Topic[] }

export class UploadFlowService extends Context.Service<
  UploadFlowService,
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
      | DbError
      | S3ClientError
      | PhoneNumberEncryptionError
      | UploadFlowApiError
      | UploadSessionRepositoryError
      | InvalidKeyFormatError
      | ExifKVRepositoryError,
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
      DbError | PhoneNumberEncryptionError | UploadFlowApiError,
      never
    >

    /**
     * By-camera device flow: resolves phone + active topic, may replace prior active-topic submission when allowed,
     * then one submission, KV session, EXIF seed, and a single presigned PUT; emits upload-flow-initialized.
     */
    readonly initializeByCameraUpload: (input: InitializeByCameraUpload) => Effect.Effect<
      {
        participantId: number
        reference: string
        uploadSessionId: string
        uploads: { key: string; url: string; contentType: string }[]
      },
      | DbError
      | S3ClientError
      | PhoneNumberEncryptionError
      | UploadFlowApiError
      | UploadSessionRepositoryError
      | InvalidKeyFormatError
      | ExifKVRepositoryError,
      never
    >

    /**
     * Staff laptop flow: keyed by `reference` (existing or new), enforces by-camera mode, phone uniqueness, and optional
     * replacement of finalized or active-topic uploads; records terms as staff-on-behalf; emits upload-flow-initialized.
     */
    readonly initializeStaffByCameraUpload: (input: InitializeStaffByCameraUpload) => Effect.Effect<
      {
        participantId: number
        reference: string
        uploadSessionId: string
        uploads: { key: string; url: string; contentType: string }[]
      },
      | DbError
      | S3ClientError
      | PhoneNumberEncryptionError
      | UploadFlowApiError
      | UploadSessionRepositoryError
      | InvalidKeyFormatError
      | ExifKVRepositoryError,
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
          activeTopicUploadState: "eligible" | "already-uploaded"
        },
      DbError | PhoneNumberEncryptionError | UploadFlowApiError | UploadSessionRepositoryError,
      never
    >

    /** Loads the marathon for a domain and masks non-public topic titles; by-camera responses expose at most one active topic. */
    readonly getPublicMarathon: (
      input: GetPublicMarathon,
    ) => Effect.Effect<PublicMarathonForClient, DbError | UploadFlowApiError, never>

    /** Returns whether a participant `reference` exists under `domain` and their stored status when it does. */
    readonly checkParticipantExists: (
      input: CheckParticipantExists,
    ) => Effect.Effect<
      { exists: false; status: null } | { exists: true; status: string },
      DbError,
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
      DbError | S3ClientError | UploadFlowApiError | UploadSessionRepositoryError,
      never
    >

    /** Sends the current KV session’s submission keys back through the upload processor queue. */
    readonly reTriggerUploadFlow: (
      input: ReTriggerUploadFlow,
    ) => Effect.Effect<
      undefined,
      UploadFlowApiError | UploadSessionRepositoryError | SQSServiceError,
      never
    >
  }
>()("@blikka/api/UploadFlowService") {}

const makeUploadFlowService = Effect.gen(function* () {
  const submissionsRepository = yield* SubmissionsRepository
  const marathonsRepository = yield* MarathonsRepository
  const participantsRepository = yield* ParticipantsRepository
  const s3 = yield* S3Service
  const sqs = yield* SQSService
  const kv = yield* UploadSessionRepository
  const exifKv = yield* ExifKVRepository
  const phoneEncryption = yield* PhoneNumberEncryptionService
  const realtimeEvents = yield* RealtimeEventsService
  const bucketName = yield* Config.string("SUBMISSIONS_BUCKET_NAME")
  const queueUrl = yield* Config.string("UPLOAD_PROCESSOR_QUEUE_URL")
  const environment = yield* Config.string("NODE_ENV").pipe(
    Config.map((env) => (env === "production" ? "prod" : "dev")),
  )

  const getMarathonByDomainOrFail = Effect.fn("UploadFlowService.getMarathonByDomainOrFail")(
    function* (domain: string) {
      return yield* marathonsRepository
        .getMarathonByDomainWithOptions({
          domain,
        })
        .pipe(
          Effect.andThen(
            Option.match({
              onSome: (marathon) => Effect.succeed(marathon),
              onNone: () =>
                Effect.fail(
                  new UploadFlowApiError({
                    message: `[${domain}] Marathon not found`,
                  }),
                ),
            }),
          ),
        )
    },
  )

  const resetAndSeedUploadExif = Effect.fn("UploadFlowService.resetAndSeedUploadExif")(function* ({
    domain,
    reference,
    staleOrderIndexes,
    orderIndexes,
    uploadExif,
  }: {
    domain: string
    reference: string
    staleOrderIndexes: readonly number[]
    orderIndexes: readonly number[]
    uploadExif?: readonly (Record<string, unknown> | null)[] | undefined
  }) {
    const orderIndexesToClear = globalThis.Array.from(
      new Set([...staleOrderIndexes, ...orderIndexes]),
    )

    yield* exifKv.deleteExifStates(domain, reference, orderIndexesToClear)

    if (uploadExif === undefined) {
      return
    }

    const exifEntries = orderIndexes.flatMap((orderIndex, index) => {
      const exif = uploadExif[index]
      return hasExifFields(exif) ? [{ orderIndex, exif }] : []
    })

    yield* Effect.forEach(
      exifEntries,
      ({ orderIndex, exif }) => exifKv.setExifState(domain, reference, orderIndex, exif),
      { concurrency: "unbounded" },
    )
  })

  const maybeRecordParticipantTermsAcceptance = Effect.fn(
    "UploadFlowService.maybeRecordParticipantTermsAcceptance",
  )(function* ({
    participant,
    marathon,
    domain,
    termsAccepted,
    acceptedLocale,
    source,
  }: {
    participant: Participant
    marathon: Marathon
    domain: string
    termsAccepted?: boolean
    acceptedLocale?: string | null
    source: "participant" | "staff-on-behalf"
  }) {
    if (termsAccepted !== true) {
      return
    }

    yield* participantsRepository.createTermsAcceptance({
      data: {
        participantId: participant.id,
        marathonId: marathon.id,
        domain,
        organizerTermsKey: marathon.termsAndConditionsKey,
        platformTermsVersion: PLATFORM_TERMS_VERSION,
        acceptedLocale: normalizeAcceptedLocale(acceptedLocale),
        source,
      },
    })
  })

  const ensureMarathonIsOpenForUploads = Effect.fn(
    "UploadFlowService.ensureMarathonIsOpenForUploads",
  )(function* ({
    domain,
    marathon,
    activeTopic,
  }: {
    domain: string
    marathon: Marathon
    activeTopic?: Topic | null
  }) {
    if (!marathon.setupCompleted) {
      return yield* Effect.fail(
        new UploadFlowApiError({
          message: `[${domain}] Marathon setup is incomplete`,
        }),
      )
    }

    if (marathon.mode === "marathon") {
      if (!marathon.startDate || !marathon.endDate) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Marathon upload window is not configured`,
          }),
        )
      }

      const startDate = new Date(marathon.startDate)
      const endDate = new Date(marathon.endDate)
      const now = new Date()

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Marathon upload window is invalid`,
          }),
        )
      }

      if (now < startDate || now > endDate) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Uploads are closed for this marathon`,
          }),
        )
      }
    }

    if (marathon.mode === "by-camera") {
      if (!activeTopic) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] No active topic found for marathon`,
          }),
        )
      }
      if (activeTopic.visibility !== "active") {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Active topic is not active`,
          }),
        )
      }
      if (!activeTopic.scheduledStart) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Active topic has not been opened for submissions`,
          }),
        )
      }
      if (new Date(activeTopic.scheduledStart) > new Date()) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Submissions are scheduled to open later`,
          }),
        )
      }
      if (activeTopic.scheduledEnd && new Date(activeTopic.scheduledEnd) <= new Date()) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Submissions are closed for this topic`,
          }),
        )
      }
    }
  })

  const getActiveByCameraTopicOrFail = Effect.fn("UploadFlowService.getActiveByCameraTopicOrFail")(
    function* ({
      domain,
      marathon,
    }: {
      domain: string
      marathon: {
        topics: Topic[]
      }
    }) {
      const activeTopic = marathon.topics.find((topic) => topic.visibility === "active")

      if (!activeTopic) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] No active topic found for marathon`,
          }),
        )
      }

      return activeTopic
    },
  )

  const getByCameraCompetitionClassIdOrFail = Effect.fn(
    "UploadFlowService.getByCameraCompetitionClassIdOrFail",
  )(function* ({
    domain,
    marathon,
  }: {
    domain: string
    marathon: { competitionClasses: CompetitionClass[] }
  }) {
    const competitionClass = marathon.competitionClasses.find(
      (resolvedCompetitionClass) => resolvedCompetitionClass.numberOfPhotos === 1,
    )

    if (!competitionClass) {
      return yield* Effect.fail(
        new UploadFlowApiError({
          message: `[${domain}] Competition class not found`,
        }),
      )
    }

    return competitionClass.id
  })

  const ensureDeviceGroupExists = Effect.fn("UploadFlowService.ensureDeviceGroupExists")(
    function* ({
      domain,
      marathon,
      deviceGroupId,
    }: {
      domain: string
      marathon: {
        deviceGroups: {
          id: number
        }[]
      }
      deviceGroupId: number
    }) {
      const deviceGroup = marathon.deviceGroups.find(
        (resolvedDeviceGroup) => resolvedDeviceGroup.id === deviceGroupId,
      )

      if (!deviceGroup) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Device group not found`,
          }),
        )
      }

      return deviceGroup
    },
  )

  const getCompetitionClassOrFail = Effect.fn("UploadFlowService.getCompetitionClassOrFail")(
    function* ({
      domain,
      marathon,
      competitionClassId,
    }: {
      domain: string
      marathon: { competitionClasses: CompetitionClass[] }
      competitionClassId: number
    }) {
      const competitionClass = marathon.competitionClasses.find(
        (resolvedCompetitionClass) => resolvedCompetitionClass.id === competitionClassId,
      )

      if (!competitionClass) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}] Competition class not found`,
          }),
        )
      }

      return competitionClass
    },
  )

  const encryptPhoneNumber = Effect.fn("UploadFlowService.encryptPhoneNumber")(function* (
    phoneNumber?: string | null,
  ) {
    return yield* Option.match(Option.fromNullishOr(normalizeOptionalPhoneNumber(phoneNumber)), {
      onSome: (resolvedPhoneNumber) =>
        phoneEncryption.encrypt({ phoneNumber: resolvedPhoneNumber }),
      onNone: () =>
        Effect.succeed<{ encrypted: null; hash: null }>({
          encrypted: null,
          hash: null,
        }),
    })
  })

  const hasSuccessfulActiveTopicUpload = Effect.fn(
    "UploadFlowService.hasSuccessfulActiveTopicUpload",
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
    if (submissionStatus && submissionStatus !== "initialized") {
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

  const resolveExistingByCameraParticipant = Effect.fn(
    "UploadFlowService.resolveExistingByCameraParticipant",
  )(function* ({ domain, phoneNumber }: { domain: string; phoneNumber: string }) {
    const marathon = yield* getMarathonByDomainOrFail(domain)

    if (marathon.mode !== "by-camera") {
      return yield* Effect.fail(
        new UploadFlowApiError({
          message: `[${domain}] Marathon is not in by-camera mode`,
        }),
      )
    }

    const activeTopic = yield* getActiveByCameraTopicOrFail({
      domain,
      marathon,
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
        activeTopicUploadState: "eligible" as const,
      }
    }

    const activeTopicSubmission = yield* submissionsRepository
      .getSubmissionByParticipantIdAndTopicId({
        participantId: existingParticipant.value.id,
        topicId: activeTopic.id,
      })
      .pipe(
        Effect.map((submission) =>
          Option.match(submission, {
            onSome: (value) => value,
            onNone: () => null,
          }),
        ),
      )

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
        ? ("already-uploaded" as const)
        : ("eligible" as const),
    }
  })

  const createByCameraParticipantWithGeneratedReference = Effect.fn(
    "UploadFlowService.createByCameraParticipantWithGeneratedReference",
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
  }: {
    domain: string
    marathonId: number
    competitionClassId: number
    deviceGroupId: number
    firstname: string
    lastname: string
    email: string
    phoneHash: string
    phoneEncrypted: string
  }) {
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
        participantMode: "by-camera",
        firstname,
        lastname,
        email,
        status: "initialized",
        phoneHash,
        phoneEncrypted,
      } satisfies NewParticipant

      const created = yield* participantsRepository
        .createParticipant({ data: participantData })
        .pipe(
          Effect.map((participant) => ({ participant, reference })),
          Effect.catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            if (message.includes("participants_domain_reference_key")) {
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
      new UploadFlowApiError({
        message: `[${domain}] Failed to allocate a unique participant reference`,
      }),
    )
  })

  const getPublicMarathon: UploadFlowService["Service"]["getPublicMarathon"] = Effect.fn(
    "UploadFlowService.getPublicMarathon",
  )(function* ({ domain }) {
    const marathon = yield* getMarathonByDomainOrFail(domain)

    const processedTopics = marathon.topics
      .reduce((acc, topic) => {
        if (topic.visibility !== "public" && topic.visibility !== "active") {
          acc.push({
            ...topic,
            name: "Redacted",
          })
        } else {
          acc.push(topic)
        }
        return acc
      }, [] as Topic[])
      .sort((a, b) => a.orderIndex - b.orderIndex)

    const topics =
      marathon.mode === "by-camera"
        ? processedTopics.filter((topic) => topic.visibility === "active").slice(0, 1)
        : processedTopics

    return {
      ...marathon,
      topics,
    }
  })

  const checkParticipantExists: UploadFlowService["Service"]["checkParticipantExists"] = Effect.fn(
    "UploadFlowService.checkParticipantExists",
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

  const prepareUploadFlow: UploadFlowService["Service"]["prepareUploadFlow"] = Effect.fn(
    "UploadFlowService.prepareUploadFlow",
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
      const marathon = yield* getMarathonByDomainOrFail(domain)

      if (marathon.mode !== "marathon") {
        return yield* Effect.fail(
          new UploadFlowApiError({
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
        if (
          existingParticipant.value.status === "completed" ||
          existingParticipant.value.status === "verified"
        ) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}|${reference}] Participant already completed upload flow`,
            }),
          )
        }

        if (existingParticipant.value.status === "initialized") {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}|${reference}] Participant already started upload flow`,
            }),
          )
        }
      }

      const { encrypted, hash } = yield* encryptPhoneNumber(phoneNumber)

      const participantData = {
        reference,
        domain,
        competitionClassId,
        deviceGroupId,
        marathonId: marathon.id,
        firstname,
        lastname,
        email,
        status: "prepared",
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

      yield* maybeRecordParticipantTermsAcceptance({
        participant,
        marathon,
        domain,
        termsAccepted,
        acceptedLocale,
        source: "participant",
      })

      return {
        participantId: participant.id,
        status: participant.status,
      }
    })

    return yield* realtimeEvents.withEventResult(executeEffect, {
      eventKey: "participant-prepared",
      environment,
      domain,
      reference,
    })
  })

  const initializeUploadFlow: UploadFlowService["Service"]["initializeUploadFlow"] = Effect.fn(
    "UploadFlowService.initializeUploadFlow",
  )(function* ({
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
  }) {
    const executeEffect = Effect.gen(function* () {
      const marathon = yield* getMarathonByDomainOrFail(domain)

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
      const staleOrderIndexes = Option.match(existingParticipantState, {
        onSome: (state) => state.orderIndexes,
        onNone: () => [] as number[],
      })

      const existingSubmissions = Option.match(existingParticipant, {
        onSome: (existing) => existing.submissions.map((submission) => submission.id),
        onNone: () => [] as number[],
      })

      const { encrypted, hash } = yield* encryptPhoneNumber(phoneNumber)

      const participantData = {
        reference,
        domain,
        competitionClassId,
        deviceGroupId,
        marathonId: marathon.id,
        firstname,
        lastname,
        email,
        status: "initialized",
        phoneHash: hash,
        phoneEncrypted: encrypted,
      } satisfies NewParticipant

      const participant: Participant = yield* Option.match(existingParticipant, {
        onSome: (existing) => {
          if (existing.status === "completed" || existing.status === "verified") {
            return Effect.fail(
              new UploadFlowApiError({
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

      yield* maybeRecordParticipantTermsAcceptance({
        participant,
        marathon,
        domain,
        termsAccepted,
        acceptedLocale,
        source: termsAcceptanceSource === "staff-on-behalf" ? "staff-on-behalf" : "participant",
      })

      const topics = pipe(
        marathon.topics,
        Array.sort(Order.mapInput(Order.Number, (topic: Topic) => topic.orderIndex)),
        Array.drop(competitionClass.topicStartIndex),
        Array.take(competitionClass.numberOfPhotos),
      )

      if (uploadContentTypes !== undefined && uploadContentTypes.length !== topics.length) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}|${reference}] uploadContentTypes length must match the number of submissions (${topics.length})`,
          }),
        )
      }

      if (uploadExif !== undefined && uploadExif.length !== topics.length) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}|${reference}] uploadExif length must match the number of submissions (${topics.length})`,
          }),
        )
      }

      const submissionKeys = yield* Effect.forEach(
        topics,
        (topic) => s3.generateSubmissionKey(domain, reference, topic.orderIndex),
        { concurrency: "unbounded" },
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
          status: "initialized",
        })),
      })

      const uploadSessionId = createUploadSessionId()
      yield* kv.initializeState(domain, reference, uploadSessionId, submissionKeys)
      yield* resetAndSeedUploadExif({
        domain,
        reference,
        staleOrderIndexes,
        orderIndexes: topics.map((topic) => topic.orderIndex),
        uploadExif,
      })

      const resolvedContentTypes =
        uploadContentTypes === undefined
          ? topics.map(() => "image/jpeg")
          : uploadContentTypes.map((raw: string) => normalizeUploadContentType(raw))

      const presignedUrls = yield* Effect.forEach(
        submissionKeys.map((key, index) => ({
          key,
          contentType: resolvedContentTypes[index]!,
        })),
        ({ key, contentType }) => s3.getPresignedUrl(bucketName, key, "PUT", { contentType }),
        { concurrency: "unbounded" },
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

    return yield* realtimeEvents.withEventResult(executeEffect, {
      eventKey: "upload-flow-initialized",
      environment,
      domain,
      reference,
    })
  })

  const resolveByCameraParticipantByPhone: UploadFlowService["Service"]["resolveByCameraParticipantByPhone"] =
    Effect.fn("UploadFlowService.resolveByCameraParticipantByPhone")(function* ({
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

  const getUploadStatus: UploadFlowService["Service"]["getUploadStatus"] = Effect.fn(
    "UploadFlowService.getUploadStatus",
  )(function* ({ domain, reference, orderIndexes }) {
    const participantState = yield* kv.getParticipantState(domain, reference)
    const submissionStates = yield* kv.getAllSubmissionStates(domain, reference, [...orderIndexes])

    return {
      participant: Option.match(participantState, {
        onSome: (state) => ({
          uploadSessionId: state.uploadSessionId ?? "",
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
        uploadSessionId: state.uploadSessionId ?? "",
        orderIndex: state.orderIndex,
        uploaded: state.uploaded,
        thumbnailKey: state.thumbnailKey,
        exifProcessed: state.exifProcessed,
      })),
    }
  })

  const initializeByCameraUpload: UploadFlowService["Service"]["initializeByCameraUpload"] =
    Effect.fn("UploadFlowService.initializeByCameraUpload")(function* ({
      domain,
      firstname,
      lastname,
      deviceGroupId,
      email,
      phoneNumber,
      uploadContentTypes,
      uploadExif,
      replaceExistingActiveTopicUpload,
      termsAccepted,
      acceptedLocale,
    }) {
      const executeEffect = Effect.gen(function* () {
        const resolved = yield* resolveExistingByCameraParticipant({
          domain,
          phoneNumber,
        })

        const { marathon, activeTopic } = resolved
        yield* ensureMarathonIsOpenForUploads({
          domain,
          marathon,
          activeTopic,
        })

        yield* ensureDeviceGroupExists({
          domain,
          marathon,
          deviceGroupId,
        })

        if (
          resolved.activeTopicUploadState === "already-uploaded" &&
          !replaceExistingActiveTopicUpload
        ) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE,
            }),
          )
        }

        const competitionClassId = yield* getByCameraCompetitionClassIdOrFail({
          domain,
          marathon,
        })

        const { encrypted, hash } = yield* encryptPhoneNumber(phoneNumber)

        if (!encrypted || !hash) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] Phone number is required`,
            }),
          )
        }

        if (uploadExif !== undefined && uploadExif.length !== 1) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] uploadExif must contain exactly one entry for by-camera upload`,
            }),
          )
        }

        if (uploadContentTypes !== undefined && uploadContentTypes.length !== 1) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] uploadContentTypes must contain exactly one entry for by-camera upload`,
            }),
          )
        }

        const resolvedContentType =
          uploadContentTypes === undefined || uploadContentTypes.length === 0
            ? "image/jpeg"
            : normalizeUploadContentType(uploadContentTypes[0])

        let participant: Participant
        let reference: string

        const existingParticipantState = resolved.existingParticipant
          ? yield* kv.getParticipantState(domain, resolved.existingParticipant.reference)
          : Option.none()
        const staleOrderIndexes = Option.match(existingParticipantState, {
          onSome: (state) => state.orderIndexes,
          onNone: () => [] as number[],
        })

        if (resolved.existingParticipant) {
          participant = yield* participantsRepository.updateParticipantById({
            id: resolved.existingParticipant.id,
            data: {
              competitionClassId,
              deviceGroupId,
              firstname,
              lastname,
              email,
              participantMode: "by-camera",
              status: "initialized",
              phoneHash: hash,
              phoneEncrypted: encrypted,
            },
          })
          reference = resolved.existingParticipant.reference
        } else {
          const created = yield* createByCameraParticipantWithGeneratedReference({
            domain,
            marathonId: marathon.id,
            competitionClassId,
            deviceGroupId,
            firstname,
            lastname,
            email,
            phoneHash: hash,
            phoneEncrypted: encrypted,
          })
          participant = created.participant
          reference = created.reference
        }

        yield* maybeRecordParticipantTermsAcceptance({
          participant,
          marathon,
          domain,
          termsAccepted,
          acceptedLocale,
          source: "participant",
        })

        if (resolved.activeTopicSubmission) {
          yield* submissionsRepository.deleteSubmissionById({
            id: resolved.activeTopicSubmission.id,
          })
        }

        const submissionKey = yield* s3.generateSubmissionKey(
          domain,
          reference,
          activeTopic.orderIndex,
          {
            contentType: resolvedContentType,
          },
        )

        yield* submissionsRepository.createSubmission({
          data: {
            participantId: participant.id,
            key: submissionKey,
            marathonId: marathon.id,
            topicId: activeTopic.id,
            status: "initialized",
          },
        })

        const uploadSessionId = createUploadSessionId()
        yield* kv.initializeState(domain, reference, uploadSessionId, [submissionKey])
        yield* resetAndSeedUploadExif({
          domain,
          reference,
          staleOrderIndexes,
          orderIndexes: [activeTopic.orderIndex],
          uploadExif,
        })

        const presignedUrl = yield* s3.getPresignedUrl(bucketName, submissionKey, "PUT", {
          contentType: resolvedContentType,
        })

        return {
          participantId: participant.id,
          reference,
          uploadSessionId,
          uploads: [
            {
              key: submissionKey,
              url: presignedUrl,
              contentType: resolvedContentType,
            },
          ],
        }
      })

      return yield* realtimeEvents.withEventResult(executeEffect, {
        eventKey: "upload-flow-initialized",
        environment,
        domain,
      })
    })

  const initializeStaffByCameraUpload: UploadFlowService["Service"]["initializeStaffByCameraUpload"] =
    Effect.fn("UploadFlowService.initializeStaffByCameraUpload")(function* ({
      domain,
      reference,
      firstname,
      lastname,
      deviceGroupId,
      email,
      phoneNumber,
      uploadContentTypes,
      uploadExif,
      replaceExistingActiveTopicUpload,
      replaceFinalizedParticipantUpload,
      termsAccepted,
      acceptedLocale,
    }) {
      const executeEffect = Effect.gen(function* () {
        const allowReplaceFinalized = replaceFinalizedParticipantUpload === true
        const marathon = yield* getMarathonByDomainOrFail(domain)

        if (marathon.mode !== "by-camera") {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] Staff by-camera upload is only available in by-camera mode`,
            }),
          )
        }

        const activeTopic = yield* getActiveByCameraTopicOrFail({
          domain,
          marathon,
        })

        yield* ensureMarathonIsOpenForUploads({
          domain,
          marathon,
          activeTopic,
        })

        yield* ensureDeviceGroupExists({
          domain,
          marathon,
          deviceGroupId,
        })

        const competitionClassId = yield* getByCameraCompetitionClassIdOrFail({
          domain,
          marathon,
        })

        const { encrypted, hash } = yield* encryptPhoneNumber(phoneNumber)

        if (!encrypted || !hash) {
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}] Phone number is required`,
            }),
          )
        }

        if (uploadContentTypes !== undefined && uploadContentTypes.length !== 1) {
          const refLabel = reference.trim() === "" ? "new" : reference
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}|${refLabel}] uploadContentTypes must contain exactly one entry for by-camera staff upload`,
            }),
          )
        }

        if (uploadExif !== undefined && uploadExif.length !== 1) {
          const refLabel = reference.trim() === "" ? "new" : reference
          return yield* Effect.fail(
            new UploadFlowApiError({
              message: `[${domain}|${refLabel}] uploadExif must contain exactly one entry for by-camera staff upload`,
            }),
          )
        }

        const resolvedContentType =
          uploadContentTypes === undefined || uploadContentTypes.length === 0
            ? "image/jpeg"
            : normalizeUploadContentType(uploadContentTypes[0])

        const existingParticipant = yield* participantsRepository.getParticipantByReference({
          reference,
          domain,
        })

        let participant: Participant
        let resolvedReference: string
        let staleOrderIndexes: readonly number[] = []

        if (Option.isSome(existingParticipant)) {
          const row = existingParticipant.value

          if (row.status === "completed" || row.status === "verified") {
            if (!allowReplaceFinalized) {
              return yield* Effect.fail(
                new UploadFlowApiError({
                  message: `[${domain}|${reference}] Participant already completed upload flow`,
                }),
              )
            }
          }

          if (row.participantMode !== "by-camera") {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: `[${domain}|${reference}] Participant is not in by-camera mode`,
              }),
            )
          }

          const otherWithPhone = yield* participantsRepository.getByPhoneHashForByCamera({
            marathonId: marathon.id,
            phoneHash: hash,
          })

          if (Option.isSome(otherWithPhone) && otherWithPhone.value.id !== row.id) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: "Another participant already uses this phone number",
              }),
            )
          }

          const activeTopicSubmission = yield* submissionsRepository
            .getSubmissionByParticipantIdAndTopicId({
              participantId: row.id,
              topicId: activeTopic.id,
            })
            .pipe(
              Effect.map((submission) =>
                Option.match(submission, {
                  onSome: (value) => value,
                  onNone: () => null,
                }),
              ),
            )

          const alreadyUploaded = yield* hasSuccessfulActiveTopicUpload({
            domain,
            reference: row.reference,
            activeTopic,
            submissionStatus: activeTopicSubmission?.status ?? null,
          })

          if (alreadyUploaded && !replaceExistingActiveTopicUpload && !allowReplaceFinalized) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE,
              }),
            )
          }

          participant = yield* participantsRepository.updateParticipantById({
            id: row.id,
            data: {
              competitionClassId,
              deviceGroupId,
              firstname,
              lastname,
              email,
              participantMode: "by-camera",
              status: "initialized",
              phoneHash: hash,
              phoneEncrypted: encrypted,
            },
          })
          resolvedReference = row.reference
          const existingParticipantState = yield* kv.getParticipantState(domain, row.reference)
          staleOrderIndexes = Option.match(existingParticipantState, {
            onSome: (state) => state.orderIndexes,
            onNone: () => [] as number[],
          })

          if (activeTopicSubmission) {
            yield* submissionsRepository.deleteSubmissionById({
              id: activeTopicSubmission.id,
            })
          }
        } else {
          const otherWithPhone = yield* participantsRepository.getByPhoneHashForByCamera({
            marathonId: marathon.id,
            phoneHash: hash,
          })

          if (Option.isSome(otherWithPhone)) {
            return yield* Effect.fail(
              new UploadFlowApiError({
                message: "Another participant already uses this phone number",
              }),
            )
          }

          const created = yield* createByCameraParticipantWithGeneratedReference({
            domain,
            marathonId: marathon.id,
            competitionClassId,
            deviceGroupId,
            firstname,
            lastname,
            email,
            phoneHash: hash,
            phoneEncrypted: encrypted,
          })
          participant = created.participant
          resolvedReference = created.reference
        }

        yield* maybeRecordParticipantTermsAcceptance({
          participant,
          marathon,
          domain,
          termsAccepted,
          acceptedLocale,
          source: "staff-on-behalf",
        })

        const submissionKey = yield* s3.generateSubmissionKey(
          domain,
          resolvedReference,
          activeTopic.orderIndex,
        )

        yield* submissionsRepository.createSubmission({
          data: {
            participantId: participant.id,
            key: submissionKey,
            marathonId: marathon.id,
            topicId: activeTopic.id,
            status: "initialized",
          },
        })

        const uploadSessionId = createUploadSessionId()
        yield* kv.initializeState(domain, resolvedReference, uploadSessionId, [submissionKey])
        yield* resetAndSeedUploadExif({
          domain,
          reference: resolvedReference,
          staleOrderIndexes,
          orderIndexes: [activeTopic.orderIndex],
          uploadExif,
        })

        const presignedUrl = yield* s3.getPresignedUrl(bucketName, submissionKey, "PUT", {
          contentType: resolvedContentType,
        })

        return {
          participantId: participant.id,
          reference: resolvedReference,
          uploadSessionId,
          uploads: [
            {
              key: submissionKey,
              url: presignedUrl,
              contentType: resolvedContentType,
            },
          ],
        }
      })

      return yield* realtimeEvents.withEventResult(executeEffect, {
        eventKey: "upload-flow-initialized",
        environment,
        domain,
      })
    })

  const refreshPresignedUploads: UploadFlowService["Service"]["refreshPresignedUploads"] =
    Effect.fn("UploadFlowService.refreshPresignedUploads")(function* ({
      domain,
      reference,
      orderIndexes,
      uploadContentTypes,
    }) {
      if (orderIndexes.length === 0) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}|${reference}] orderIndexes must not be empty`,
          }),
        )
      }

      if (uploadContentTypes !== undefined && uploadContentTypes.length !== orderIndexes.length) {
        return yield* Effect.fail(
          new UploadFlowApiError({
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
                  new UploadFlowApiError({
                    message: `[${domain}|${reference}] Participant not found`,
                  }),
                ),
            }),
          ),
        )

      if (isParticipantFinalized(participant.status)) {
        return yield* Effect.fail(
          new UploadFlowApiError({
            message: `[${domain}|${reference}] Participant already completed upload flow`,
          }),
        )
      }

      const participantState = yield* kv.getParticipantState(domain, reference)
      if (Option.isNone(participantState)) {
        return yield* Effect.fail(
          new UploadFlowApiError({
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
          new UploadFlowApiError({
            message: `[${domain}|${reference}] Missing submissions for order indexes: ${missingOrderIndexes.join(", ")}`,
          }),
        )
      }

      const resolvedContentTypes =
        uploadContentTypes === undefined
          ? orderIndexes.map(() => "image/jpeg")
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
            .getPresignedUrl(bucketName, submissionState.key, "PUT", {
              contentType,
            })
            .pipe(
              Effect.map((url) => ({
                key: submissionState.key,
                url,
                contentType,
              })),
            ),
        { concurrency: "unbounded" },
      )
    })

  const reTriggerUploadFlow: UploadFlowService["Service"]["reTriggerUploadFlow"] = Effect.fn(
    "UploadFlowService.reTriggerUploadFlow",
  )(function* ({ domain, reference }) {
    const participantState = yield* kv.getParticipantState(domain, reference)
    if (Option.isNone(participantState)) {
      return yield* Effect.fail(
        new UploadFlowApiError({
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
    initializeUploadFlow,
    prepareUploadFlow,
    initializeByCameraUpload,
    initializeStaffByCameraUpload,
    resolveByCameraParticipantByPhone,
    getPublicMarathon,
    checkParticipantExists,
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
      ExifKVRepositoryLayer,
      RealtimeEventsServiceLayer,
      PhoneNumberEncryptionServiceLayer,
    ),
  ),
)
