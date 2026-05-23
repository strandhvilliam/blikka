import type { CompetitionClass, DeviceGroup, Participant } from '@blikka/db'

export type MarathonMode = 'marathon' | 'by-camera' | string

export interface SubmissionsMarathon {
  mode: MarathonMode
  topics: {
    id: number
    name: string
    orderIndex: number
    visibility: string
  }[]
  competitionClasses: {
    id: number
    name: string
    numberOfPhotos?: number | null
  }[]
  deviceGroups: {
    id: number
    name: string
  }[]
}

export type SubmissionTableRow = Omit<Participant, 'phoneEncrypted' | 'phoneHash'> & {
  phoneNumber?: string | null
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  activeTopicSubmissionId: number | null
  activeTopicSubmissionCreatedAt: string | null
  submissionHealth: {
    hasExif: boolean
    hasThumbnail: boolean
  } | null
  failedValidationResults: { errors: number; warnings: number }
  passedValidationResults: { errors: number; warnings: number }
  skippedValidationResults: { errors: number; warnings: number }
  zipKeys: string[]
  contactSheetKeys: string[]
  votingSession: { votedAt: string | null } | null
}

export type RealtimeEnrichedSubmissionTableRow = SubmissionTableRow & {
  realtimeProcessedCount: number
  realtimeIsFinalized: boolean
}
