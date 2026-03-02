import type {
  CompetitionClass,
  DeviceGroup,
  Participant,
  ParticipantVerification,
  Submission,
  Topic,
  ValidationResult,
} from "@blikka/db"

export type StaffSubmission = Submission & {
  topic?: Topic | null
}

export type StaffParticipant = Participant & {
  validationResults: ValidationResult[]
  submissions: StaffSubmission[]
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
}

export type StaffVerification = ParticipantVerification & {
  participant: StaffParticipant
}
