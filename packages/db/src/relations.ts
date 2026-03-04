import { defineRelations } from "drizzle-orm"
import * as schema from "./schema"

export const relations = defineRelations(schema, (r) => ({
  juryRatings: {
    juryInvitation: r.one.juryInvitations({
      from: r.juryRatings.invitationId,
      to: r.juryInvitations.id,
      optional: false,
    }),
    marathon: r.one.marathons({
      from: r.juryRatings.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
    participant: r.one.participants({
      from: r.juryRatings.participantId,
      to: r.participants.id,
      optional: false,
    }),
  },

  juryInvitations: {
    juryRatings: r.many.juryRatings({
      from: r.juryInvitations.id,
      to: r.juryRatings.invitationId,
    }),
    competitionClass: r.one.competitionClasses({
      from: r.juryInvitations.competitionClassId,
      to: r.competitionClasses.id,
    }),
    deviceGroup: r.one.deviceGroups({
      from: r.juryInvitations.deviceGroupId,
      to: r.deviceGroups.id,
    }),
    marathon: r.one.marathons({
      from: r.juryInvitations.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
    topic: r.one.topics({
      from: r.juryInvitations.topicId,
      to: r.topics.id,
    }),
  },

  marathons: {
    juryRatings: r.many.juryRatings({
      from: r.marathons.id,
      to: r.juryRatings.marathonId,
    }),
    ruleConfigs: r.many.ruleConfigs({
      from: r.marathons.id,
      to: r.ruleConfigs.marathonId,
    }),
    juryInvitations: r.many.juryInvitations({
      from: r.marathons.id,
      to: r.juryInvitations.marathonId,
    }),
    participants: r.many.participants({
      from: r.marathons.id,
      to: r.participants.marathonId,
    }),
    userMarathons: r.many.userMarathons({
      from: r.marathons.id,
      to: r.userMarathons.marathonId,
    }),
    competitionClasses: r.many.competitionClasses({
      from: r.marathons.id,
      to: r.competitionClasses.marathonId,
    }),
    deviceGroups: r.many.deviceGroups({
      from: r.marathons.id,
      to: r.deviceGroups.marathonId,
    }),
    submissions: r.many.submissions({
      from: r.marathons.id,
      to: r.submissions.marathonId,
    }),
    topics: r.many.topics({
      from: r.marathons.id,
      to: r.topics.marathonId,
    }),
    zippedSubmissions: r.many.zippedSubmissions({
      from: r.marathons.id,
      to: r.zippedSubmissions.marathonId,
    }),
    sponsors: r.many.sponsors({
      from: r.marathons.id,
      to: r.sponsors.marathonId,
    }),
  },

  participants: {
    juryRatings: r.many.juryRatings({
      from: r.participants.id,
      to: r.juryRatings.participantId,
    }),
    competitionClass: r.one.competitionClasses({
      from: r.participants.competitionClassId,
      to: r.competitionClasses.id,
    }),
    deviceGroup: r.one.deviceGroups({
      from: r.participants.deviceGroupId,
      to: r.deviceGroups.id,
    }),
    marathon: r.one.marathons({
      from: r.participants.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
    validationResults: r.many.validationResults({
      from: r.participants.id,
      to: r.validationResults.participantId,
    }),
    participantVerifications: r.many.participantVerifications({
      from: r.participants.id,
      to: r.participantVerifications.participantId,
    }),
    submissions: r.many.submissions({
      from: r.participants.id,
      to: r.submissions.participantId,
    }),
    zippedSubmissions: r.many.zippedSubmissions({
      from: r.participants.id,
      to: r.zippedSubmissions.participantId,
    }),
    contactSheets: r.many.contactSheets({
      from: r.participants.id,
      to: r.contactSheets.participantId,
    }),
    votingSessions: r.many.votingSession({
      from: r.participants.id,
      to: r.votingSession.connectedParticipantId,
    }),
  },

  ruleConfigs: {
    marathon: r.one.marathons({
      from: r.ruleConfigs.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
  },

  competitionClasses: {
    juryInvitations: r.many.juryInvitations({
      from: r.competitionClasses.id,
      to: r.juryInvitations.competitionClassId,
    }),
    participants: r.many.participants({
      from: r.competitionClasses.id,
      to: r.participants.competitionClassId,
    }),
    marathon: r.one.marathons({
      from: r.competitionClasses.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
  },

  deviceGroups: {
    juryInvitations: r.many.juryInvitations({
      from: r.deviceGroups.id,
      to: r.juryInvitations.deviceGroupId,
    }),
    participants: r.many.participants({
      from: r.deviceGroups.id,
      to: r.participants.deviceGroupId,
    }),
    marathon: r.one.marathons({
      from: r.deviceGroups.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
  },

  topics: {
    juryInvitations: r.many.juryInvitations({
      from: r.topics.id,
      to: r.juryInvitations.topicId,
    }),
    submissions: r.many.submissions({
      from: r.topics.id,
      to: r.submissions.topicId,
    }),
    marathon: r.one.marathons({
      from: r.topics.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
  },

  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
      optional: false,
    }),
  },

  user: {
    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),
    userMarathons: r.many.userMarathons({
      from: r.user.id,
      to: r.userMarathons.userId,
    }),
    participantVerifications: r.many.participantVerifications({
      from: r.user.id,
      to: r.participantVerifications.staffId,
    }),
  },

  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
      optional: false,
    }),
  },

  userMarathons: {
    marathon: r.one.marathons({
      from: r.userMarathons.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
    user: r.one.user({
      from: r.userMarathons.userId,
      to: r.user.id,
      optional: false,
    }),
  },

  validationResults: {
    participant: r.one.participants({
      from: r.validationResults.participantId,
      to: r.participants.id,
      optional: false,
    }),
  },

  participantVerifications: {
    user: r.one.user({
      from: r.participantVerifications.staffId,
      to: r.user.id,
      optional: false,
    }),
    participant: r.one.participants({
      from: r.participantVerifications.participantId,
      to: r.participants.id,
      optional: false,
    }),
  },

  submissions: {
    marathon: r.one.marathons({
      from: r.submissions.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
    participant: r.one.participants({
      from: r.submissions.participantId,
      to: r.participants.id,
      optional: false,
    }),
    topic: r.one.topics({
      from: r.submissions.topicId,
      to: r.topics.id,
      optional: false,
    }),
  },

  zippedSubmissions: {
    marathon: r.one.marathons({
      from: r.zippedSubmissions.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
    participant: r.one.participants({
      from: r.zippedSubmissions.participantId,
      to: r.participants.id,
      optional: false,
    }),
  },

  contactSheets: {
    marathon: r.one.marathons({
      from: r.contactSheets.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
    participant: r.one.participants({
      from: r.contactSheets.participantId,
      to: r.participants.id,
      optional: false,
    }),
  },

  sponsors: {
    marathon: r.one.marathons({
      from: r.sponsors.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
  },

  votingSession: {
    marathon: r.one.marathons({
      from: r.votingSession.marathonId,
      to: r.marathons.id,
      optional: false,
    }),
    participant: r.one.participants({
      from: r.votingSession.connectedParticipantId,
      to: r.participants.id,
    }),
    topic: r.one.topics({
      from: r.votingSession.topicId,
      to: r.topics.id,
      optional: false,
    }),
    submissions: r.one.submissions({
      from: r.votingSession.voteSubmissionId,
      to: r.submissions.id,
    }),
  },
}))
