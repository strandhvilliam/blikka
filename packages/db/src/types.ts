import {
  deviceGroups,
  competitionClasses,
  participants,
  submissions,
  validationResults,
  marathons,
  topics,
  userMarathons,
  pendingUserMarathons,
  ruleConfigs,
  juryInvitations,
  juryRatings,
  juryFinalRankings,
  user,
  zippedSubmissions,
  participantVerifications,
  sponsors,
  contactSheets,
  votingSession,
  votingRound,
  votingRoundSubmission,
  votingRoundVote,
} from "./schema";

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

export type ValidationResult = typeof validationResults.$inferSelect;
export type NewValidationResult = typeof validationResults.$inferInsert;

export type CompetitionClass = typeof competitionClasses.$inferSelect;
export type NewCompetitionClass = typeof competitionClasses.$inferInsert;

export type DeviceGroup = typeof deviceGroups.$inferSelect;
export type NewDeviceGroup = typeof deviceGroups.$inferInsert;

export type Marathon = typeof marathons.$inferSelect;
export type NewMarathon = typeof marathons.$inferInsert;

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;

export type UserMarathonRelation = typeof userMarathons.$inferSelect;
export type NewUserMarathonRelation = typeof userMarathons.$inferInsert;

export type PendingUserMarathonRelation =
  typeof pendingUserMarathons.$inferSelect;
export type NewPendingUserMarathonRelation =
  typeof pendingUserMarathons.$inferInsert;

export type RuleConfig = typeof ruleConfigs.$inferSelect;
export type NewRuleConfig = typeof ruleConfigs.$inferInsert;

export type JuryInvitation = typeof juryInvitations.$inferSelect;
export type NewJuryInvitation = typeof juryInvitations.$inferInsert;

export type JuryRating = typeof juryRatings.$inferSelect;
export type NewJuryRating = typeof juryRatings.$inferInsert;

export type JuryFinalRanking = typeof juryFinalRankings.$inferSelect;
export type NewJuryFinalRanking = typeof juryFinalRankings.$inferInsert;

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type ZippedSubmission = typeof zippedSubmissions.$inferSelect;
export type NewZippedSubmission = typeof zippedSubmissions.$inferInsert;

export type ParticipantVerification =
  typeof participantVerifications.$inferSelect;
export type NewParticipantVerification =
  typeof participantVerifications.$inferInsert;

export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;

export type ContactSheet = typeof contactSheets.$inferSelect;
export type NewContactSheet = typeof contactSheets.$inferInsert;

export type VotingSession = typeof votingSession.$inferSelect;
export type NewVotingSession = typeof votingSession.$inferInsert;

export type VotingRound = typeof votingRound.$inferSelect;
export type NewVotingRound = typeof votingRound.$inferInsert;

export type VotingRoundSubmission = typeof votingRoundSubmission.$inferSelect;
export type NewVotingRoundSubmission =
  typeof votingRoundSubmission.$inferInsert;

export type VotingRoundVote = typeof votingRoundVote.$inferSelect;
export type NewVotingRoundVote = typeof votingRoundVote.$inferInsert;
