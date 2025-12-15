import {
  deviceGroups,
  competitionClasses,
  participants,
  submissions,
  validationResults,
  marathons,
  topics,
  userMarathons,
  ruleConfigs,
  juryInvitations,
  user,
  zippedSubmissions,
  participantVerifications,
  sponsors,
  contactSheets,
} from "./schema"

export type Participant = typeof participants.$inferSelect
export type NewParticipant = typeof participants.$inferInsert

export type Submission = typeof submissions.$inferSelect
export type NewSubmission = typeof submissions.$inferInsert

export type ValidationResult = typeof validationResults.$inferSelect
export type NewValidationResult = typeof validationResults.$inferInsert

export type CompetitionClass = typeof competitionClasses.$inferSelect
export type NewCompetitionClass = typeof competitionClasses.$inferInsert

export type DeviceGroup = typeof deviceGroups.$inferSelect
export type NewDeviceGroup = typeof deviceGroups.$inferInsert

export type Marathon = typeof marathons.$inferSelect
export type NewMarathon = typeof marathons.$inferInsert

export type Topic = typeof topics.$inferSelect
export type NewTopic = typeof topics.$inferInsert

export type UserMarathonRelation = typeof userMarathons.$inferSelect
export type NewUserMarathonRelation = typeof userMarathons.$inferInsert

export type RuleConfig = typeof ruleConfigs.$inferSelect
export type NewRuleConfig = typeof ruleConfigs.$inferInsert

export type JuryInvitation = typeof juryInvitations.$inferSelect
export type NewJuryInvitation = typeof juryInvitations.$inferInsert

export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert

export type ZippedSubmission = typeof zippedSubmissions.$inferSelect
export type NewZippedSubmission = typeof zippedSubmissions.$inferInsert

export type ParticipantVerification = typeof participantVerifications.$inferSelect
export type NewParticipantVerification = typeof participantVerifications.$inferInsert

export type Sponsor = typeof sponsors.$inferSelect
export type NewSponsor = typeof sponsors.$inferInsert

export type ContactSheet = typeof contactSheets.$inferSelect
export type NewContactSheet = typeof contactSheets.$inferInsert
