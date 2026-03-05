import { relations } from "drizzle-orm";
import * as schema from "./schema";

export const juryRatingsRelations = relations(
  schema.juryRatings,
  ({ one }) => ({
    juryInvitation: one(schema.juryInvitations, {
      fields: [schema.juryRatings.invitationId],
      references: [schema.juryInvitations.id],
    }),
    marathon: one(schema.marathons, {
      fields: [schema.juryRatings.marathonId],
      references: [schema.marathons.id],
    }),
    participant: one(schema.participants, {
      fields: [schema.juryRatings.participantId],
      references: [schema.participants.id],
    }),
  }),
);

export const juryInvitationsRelations = relations(
  schema.juryInvitations,
  ({ one, many }) => ({
    juryRatings: many(schema.juryRatings),
    competitionClass: one(schema.competitionClasses, {
      fields: [schema.juryInvitations.competitionClassId],
      references: [schema.competitionClasses.id],
    }),
    deviceGroup: one(schema.deviceGroups, {
      fields: [schema.juryInvitations.deviceGroupId],
      references: [schema.deviceGroups.id],
    }),
    marathon: one(schema.marathons, {
      fields: [schema.juryInvitations.marathonId],
      references: [schema.marathons.id],
    }),
    topic: one(schema.topics, {
      fields: [schema.juryInvitations.topicId],
      references: [schema.topics.id],
    }),
  }),
);

export const marathonsRelations = relations(schema.marathons, ({ many }) => ({
  juryRatings: many(schema.juryRatings),
  ruleConfigs: many(schema.ruleConfigs),
  juryInvitations: many(schema.juryInvitations),
  participants: many(schema.participants),
  userMarathons: many(schema.userMarathons),
  competitionClasses: many(schema.competitionClasses),
  deviceGroups: many(schema.deviceGroups),
  submissions: many(schema.submissions),
  topics: many(schema.topics),
  zippedSubmissions: many(schema.zippedSubmissions),
  sponsors: many(schema.sponsors),
}));

export const participantsRelations = relations(
  schema.participants,
  ({ one, many }) => ({
    juryRatings: many(schema.juryRatings),
    competitionClass: one(schema.competitionClasses, {
      fields: [schema.participants.competitionClassId],
      references: [schema.competitionClasses.id],
    }),
    deviceGroup: one(schema.deviceGroups, {
      fields: [schema.participants.deviceGroupId],
      references: [schema.deviceGroups.id],
    }),
    marathon: one(schema.marathons, {
      fields: [schema.participants.marathonId],
      references: [schema.marathons.id],
    }),
    validationResults: many(schema.validationResults),
    participantVerifications: many(schema.participantVerifications),
    submissions: many(schema.submissions),
    zippedSubmissions: many(schema.zippedSubmissions),
    contactSheets: many(schema.contactSheets),
    votingSessions: many(schema.votingSession),
  }),
);

export const ruleConfigsRelations = relations(
  schema.ruleConfigs,
  ({ one }) => ({
    marathon: one(schema.marathons, {
      fields: [schema.ruleConfigs.marathonId],
      references: [schema.marathons.id],
    }),
  }),
);

export const competitionClassesRelations = relations(
  schema.competitionClasses,
  ({ one, many }) => ({
    juryInvitations: many(schema.juryInvitations),
    participants: many(schema.participants),
    marathon: one(schema.marathons, {
      fields: [schema.competitionClasses.marathonId],
      references: [schema.marathons.id],
    }),
  }),
);

export const deviceGroupsRelations = relations(
  schema.deviceGroups,
  ({ one, many }) => ({
    juryInvitations: many(schema.juryInvitations),
    participants: many(schema.participants),
    marathon: one(schema.marathons, {
      fields: [schema.deviceGroups.marathonId],
      references: [schema.marathons.id],
    }),
  }),
);

export const topicsRelations = relations(schema.topics, ({ one, many }) => ({
  juryInvitations: many(schema.juryInvitations),
  submissions: many(schema.submissions),
  marathon: one(schema.marathons, {
    fields: [schema.topics.marathonId],
    references: [schema.marathons.id],
  }),
}));

export const accountRelations = relations(schema.account, ({ one }) => ({
  user: one(schema.user, {
    fields: [schema.account.userId],
    references: [schema.user.id],
  }),
}));

export const userRelations = relations(schema.user, ({ many }) => ({
  accounts: many(schema.account),
  sessions: many(schema.session),
  userMarathons: many(schema.userMarathons),
  participantVerifications: many(schema.participantVerifications),
}));

export const sessionRelations = relations(schema.session, ({ one }) => ({
  user: one(schema.user, {
    fields: [schema.session.userId],
    references: [schema.user.id],
  }),
}));

export const userMarathonsRelations = relations(
  schema.userMarathons,
  ({ one }) => ({
    marathon: one(schema.marathons, {
      fields: [schema.userMarathons.marathonId],
      references: [schema.marathons.id],
    }),
    user: one(schema.user, {
      fields: [schema.userMarathons.userId],
      references: [schema.user.id],
    }),
  }),
);

export const validationResultsRelations = relations(
  schema.validationResults,
  ({ one }) => ({
    participant: one(schema.participants, {
      fields: [schema.validationResults.participantId],
      references: [schema.participants.id],
    }),
  }),
);

export const participantVerificationsRelations = relations(
  schema.participantVerifications,
  ({ one }) => ({
    user: one(schema.user, {
      fields: [schema.participantVerifications.staffId],
      references: [schema.user.id],
    }),
    participant: one(schema.participants, {
      fields: [schema.participantVerifications.participantId],
      references: [schema.participants.id],
    }),
  }),
);

export const submissionsRelations = relations(
  schema.submissions,
  ({ one }) => ({
    marathon: one(schema.marathons, {
      fields: [schema.submissions.marathonId],
      references: [schema.marathons.id],
    }),
    participant: one(schema.participants, {
      fields: [schema.submissions.participantId],
      references: [schema.participants.id],
    }),
    topic: one(schema.topics, {
      fields: [schema.submissions.topicId],
      references: [schema.topics.id],
    }),
  }),
);

export const zippedSubmissionsRelations = relations(
  schema.zippedSubmissions,
  ({ one }) => ({
    marathon: one(schema.marathons, {
      fields: [schema.zippedSubmissions.marathonId],
      references: [schema.marathons.id],
    }),
    participant: one(schema.participants, {
      fields: [schema.zippedSubmissions.participantId],
      references: [schema.participants.id],
    }),
  }),
);

export const contactSheetsRelations = relations(
  schema.contactSheets,
  ({ one }) => ({
    marathon: one(schema.marathons, {
      fields: [schema.contactSheets.marathonId],
      references: [schema.marathons.id],
    }),
    participant: one(schema.participants, {
      fields: [schema.contactSheets.participantId],
      references: [schema.participants.id],
    }),
  }),
);

export const sponsorsRelations = relations(schema.sponsors, ({ one }) => ({
  marathon: one(schema.marathons, {
    fields: [schema.sponsors.marathonId],
    references: [schema.marathons.id],
  }),
}));

export const votingSessionRelations = relations(
  schema.votingSession,
  ({ one }) => ({
    marathon: one(schema.marathons, {
      fields: [schema.votingSession.marathonId],
      references: [schema.marathons.id],
    }),
    participant: one(schema.participants, {
      fields: [schema.votingSession.connectedParticipantId],
      references: [schema.participants.id],
    }),
    topic: one(schema.topics, {
      fields: [schema.votingSession.topicId],
      references: [schema.topics.id],
    }),
    submissions: one(schema.submissions, {
      fields: [schema.votingSession.voteSubmissionId],
      references: [schema.submissions.id],
    }),
  }),
);
