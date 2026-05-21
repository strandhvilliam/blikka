import { Effect, Option } from 'effect'
import type {
  CompetitionClass,
  DbError,
  Marathon,
  Participant,
  ParticipantsRepository,
  Topic,
} from '@blikka/db'
import type { ParticipantState } from '@blikka/kv-store'

import { BadRequestError } from '../errors'
import {
  PhoneNumberEncryptionService,
  type PhoneNumberEncryptionError,
} from '../utils/phone-number-encryption'

type ParticipantsRepositoryService = ParticipantsRepository['Service']
type PhoneNumberEncryptionServiceApi = PhoneNumberEncryptionService['Service']

export type MarathonWithRelations = Marathon & {
  topics: Topic[]
  competitionClasses: CompetitionClass[]
  deviceGroups: { id: number }[]
}

export type DeviceByCameraParticipantContext = {
  marathon: MarathonWithRelations
  activeTopic: Topic
  phoneHash: string
  existingParticipant: Participant | null
  activeTopicSubmission: { id: number; status: string } | null
  activeTopicUploadState: 'eligible' | 'already-uploaded'
}

export const ACTIVE_TOPIC_ALREADY_UPLOADED_MESSAGE =
  'You have already uploaded a photo for the current topic.'

const ALLOWED_MARATHON_UPLOAD_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
])

/** Normalizes client-provided MIME types for S3 presigned PUT signatures. */
export function normalizeUploadContentType(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim().toLowerCase()
  if (trimmed === '' || trimmed === 'image/jpg') {
    return 'image/jpeg'
  }
  if (ALLOWED_MARATHON_UPLOAD_CONTENT_TYPES.has(trimmed)) {
    return trimmed
  }
  return 'image/jpeg'
}

export function isParticipantFinalized(status: Participant['status']) {
  return status === 'completed' || status === 'verified'
}

export function staleOrderIndexesFromParticipantState(
  state: Option.Option<ParticipantState>,
): readonly number[] {
  return Option.match(state, {
    onSome: (participantState) => participantState.orderIndexes,
    onNone: () => [],
  })
}

export function ensureDeviceGroupExists({
  domain,
  marathon,
  deviceGroupId,
}: {
  domain: string
  marathon: { deviceGroups: { id: number }[] }
  deviceGroupId: number
}): Effect.Effect<{ id: number }, BadRequestError> {
  const deviceGroup = marathon.deviceGroups.find(
    (resolvedDeviceGroup) => resolvedDeviceGroup.id === deviceGroupId,
  )

  if (!deviceGroup) {
    return Effect.fail(
      new BadRequestError({
        message: `[${domain}] Device group not found`,
      }),
    )
  }

  return Effect.succeed(deviceGroup)
}

export function getCompetitionClassOrFail({
  domain,
  marathon,
  competitionClassId,
}: {
  domain: string
  marathon: { competitionClasses: CompetitionClass[] }
  competitionClassId: number
}): Effect.Effect<CompetitionClass, BadRequestError> {
  const competitionClass = marathon.competitionClasses.find(
    (resolvedCompetitionClass) => resolvedCompetitionClass.id === competitionClassId,
  )

  if (!competitionClass) {
    return Effect.fail(
      new BadRequestError({
        message: `[${domain}] Competition class not found`,
      }),
    )
  }

  return Effect.succeed(competitionClass)
}

function normalizeOptionalPhoneNumber(phoneNumber?: string | null) {
  const normalizedPhoneNumber = phoneNumber?.trim()

  return normalizedPhoneNumber ? normalizedPhoneNumber : null
}

export function encryptOptionalPhoneNumber(
  phoneEncryption: PhoneNumberEncryptionServiceApi,
  phoneNumber?: string | null,
): Effect.Effect<
  { encrypted: string; hash: string } | { encrypted: null; hash: null },
  PhoneNumberEncryptionError
> {
  return Option.match(Option.fromNullishOr(normalizeOptionalPhoneNumber(phoneNumber)), {
    onSome: (resolvedPhoneNumber) => phoneEncryption.encrypt({ phoneNumber: resolvedPhoneNumber }),
    onNone: () =>
      Effect.succeed<{ encrypted: null; hash: null }>({
        encrypted: null,
        hash: null,
      }),
  })
}

const PLATFORM_TERMS_VERSION = 'blikka-terms-2026-05-01'

function normalizeAcceptedLocale(locale?: string | null) {
  const normalizedLocale = locale?.trim()

  return normalizedLocale ? normalizedLocale : null
}

export function maybeRecordParticipantTermsAcceptance(
  participantsRepository: ParticipantsRepositoryService,
  {
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
    source: 'participant' | 'staff-on-behalf'
  },
): Effect.Effect<void, DbError> {
  if (termsAccepted !== true) {
    return Effect.void
  }

  return participantsRepository.createTermsAcceptance({
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
}
