import {
  pgTable,
  foreignKey,
  bigint,
  timestamp,
  smallint,
  text,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  integer,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const juryRatings = pgTable(
  "jury_ratings",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    invitationId: bigint("invitation_id", { mode: "number" }).notNull(),
    rating: smallint().notNull(),
    participantId: bigint("participant_id", { mode: "number" }).notNull(),
    notes: text(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
  },
  (table) => [
    unique("jury_ratings_invitation_participant_key").on(
      table.invitationId,
      table.participantId,
    ),
    index("jury_ratings_invitation_id_idx").on(table.invitationId),
    index("jury_ratings_participant_id_idx").on(table.participantId),
    index("jury_ratings_marathon_id_idx").on(table.marathonId),
    foreignKey({
      columns: [table.invitationId],
      foreignColumns: [juryInvitations.id],
      name: "jury_ratings_invitation_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "jury_ratings_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.participantId],
      foreignColumns: [participants.id],
      name: "jury_ratings_participant_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const juryFinalRankings = pgTable(
  "jury_final_rankings",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    invitationId: bigint("invitation_id", { mode: "number" }).notNull(),
    participantId: bigint("participant_id", { mode: "number" }).notNull(),
    rank: smallint().notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
  },
  (table) => [
    unique("jury_final_rankings_invitation_participant_key").on(
      table.invitationId,
      table.participantId,
    ),
    unique("jury_final_rankings_invitation_rank_key").on(
      table.invitationId,
      table.rank,
    ),
    index("jury_final_rankings_invitation_id_idx").on(table.invitationId),
    index("jury_final_rankings_participant_id_idx").on(table.participantId),
    index("jury_final_rankings_marathon_id_idx").on(table.marathonId),
    check("jury_final_rankings_rank_check", sql`${table.rank} in (1, 2, 3)`),
    foreignKey({
      columns: [table.invitationId],
      foreignColumns: [juryInvitations.id],
      name: "jury_final_rankings_invitation_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "jury_final_rankings_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.participantId],
      foreignColumns: [participants.id],
      name: "jury_final_rankings_participant_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const ruleConfigs = pgTable(
  "rule_configs",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    ruleKey: text("rule_key").notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    params: jsonb().$type<Record<string, unknown>>(),
    severity: text().default("warning").notNull(),
    enabled: boolean().default(false).notNull(),
  },
  (table) => [
    index("rule_configs_marathon_id_idx").on(table.marathonId),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "rule_configs_marathon_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const juryInvitations = pgTable(
  "jury_invitations",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    status: text(),
    token: text().notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    email: text().notNull(),
    displayName: text("display_name").notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    topicId: bigint("topic_id", { mode: "number" }),
    competitionClassId: bigint("competition_class_id", { mode: "number" }),
    deviceGroupId: bigint("device_group_id", { mode: "number" }),
    notes: text(),
    inviteType: text("invite_type").default("topic").notNull(),
  },
  (table) => [
    uniqueIndex("jury_invitations_token_unique_idx").on(table.token),
    index("jury_invitations_marathon_id_idx").on(table.marathonId),
    check(
      "jury_invitations_invite_type_check",
      sql`${table.inviteType} in ('topic', 'class', 'custom', 'all', 'device')`,
    ),
    foreignKey({
      columns: [table.competitionClassId],
      foreignColumns: [competitionClasses.id],
      name: "jury_invitations_competition_class_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.deviceGroupId],
      foreignColumns: [deviceGroups.id],
      name: "jury_invitations_device_group_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "jury_invitations_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.topicId],
      foreignColumns: [topics.id],
      name: "jury_invitations_topic_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const participants = pgTable(
  "participants",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    reference: text().notNull(),
    email: text(),
    status: text().default("initialized").notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    competitionClassId: bigint("competition_class_id", { mode: "number" }),
    deviceGroupId: bigint("device_group_id", { mode: "number" }),
    domain: text().notNull(),
    participantMode: text("participant_mode").default("marathon").notNull(),
    firstname: text().notNull(),
    lastname: text().notNull(),
    phoneHash: text("phone_hash"),
    phoneEncrypted: text("phone_encrypted"),
  },
  (table) => [
    index("participants_domain_idx").using(
      "btree",
      table.domain.asc().nullsLast().op("text_ops"),
    ),
    index("participants_reference_domain_idx").using(
      "btree",
      table.reference.asc().nullsLast().op("text_ops"),
      table.domain.asc().nullsLast().op("text_ops"),
    ),
    index("participants_reference_idx").using(
      "btree",
      table.reference.asc().nullsLast().op("text_ops"),
    ),
    index("participants_marathon_phone_hash_idx").using(
      "btree",
      table.marathonId.asc().nullsLast().op("int8_ops"),
      table.phoneHash.asc().nullsLast().op("text_ops"),
    ),
    unique("participants_domain_reference_key").on(
      table.domain,
      table.reference,
    ),
    foreignKey({
      columns: [table.competitionClassId],
      foreignColumns: [competitionClasses.id],
      name: "participants_competition_class_id_fkey",
    }),
    foreignKey({
      columns: [table.deviceGroupId],
      foreignColumns: [deviceGroups.id],
      name: "participants_device_group_id_fkey",
    }),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "participants_marathon_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ mode: "string" }),
    refreshTokenExpiresAt: timestamp({ mode: "string" }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ mode: "string" }).notNull(),
    updatedAt: timestamp({ mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_userId_fkey",
    }).onDelete("cascade"),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp({ mode: "string" }).notNull(),
    token: text().notNull(),
    createdAt: timestamp({ mode: "string" }).notNull(),
    updatedAt: timestamp({ mode: "string" }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_userId_fkey",
    }).onDelete("cascade"),
    unique("session_token_key").on(table.token),
  ],
);

export const userMarathons = pgTable(
  "user_marathons",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    role: text().default("staff").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [
    index("user_marathons_marathon_id_idx").on(table.marathonId),
    index("user_marathons_user_id_idx").on(table.userId),
    unique("user_marathons_marathon_user_key").on(
      table.marathonId,
      table.userId,
    ),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "user_marathons_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "user_marathons_user_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const pendingUserMarathons = pgTable(
  "pending_user_marathons",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    email: text().notNull(),
    emailNormalized: text("email_normalized").notNull(),
    name: text().notNull(),
    role: text().default("staff").notNull(),
    invitedByUserId: text("invited_by_user_id"),
  },
  (table) => [
    index("pending_user_marathons_marathon_id_idx").on(table.marathonId),
    index("pending_user_marathons_email_normalized_idx").on(
      table.emailNormalized,
    ),
    unique("pending_user_marathons_marathon_email_key").on(
      table.marathonId,
      table.emailNormalized,
    ),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "pending_user_marathons_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.invitedByUserId],
      foreignColumns: [user.id],
      name: "pending_user_marathons_invited_by_user_id_fkey",
    }).onDelete("set null"),
  ],
);

export const validationResults = pgTable(
  "validation_results",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    outcome: text().notNull(),
    ruleKey: text("rule_key").notNull(),
    message: text().notNull(),
    fileName: text("file_name"),
    severity: text().notNull(),
    participantId: bigint("participant_id", { mode: "number" }).notNull(),
    overruled: boolean().default(false).notNull(),
  },
  (table) => [
    index("validation_results_participant_id_idx").using(
      "btree",
      table.participantId.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.participantId],
      foreignColumns: [participants.id],
      name: "validation_results_participant_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const verification = pgTable("verification", {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ mode: "string" }).notNull(),
  createdAt: timestamp({ mode: "string" }),
  updatedAt: timestamp({ mode: "string" }),
});

export const marathons = pgTable(
  "marathons",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    domain: text().notNull(),
    name: text().notNull(),
    startDate: timestamp("start_date", { withTimezone: true, mode: "string" }),
    endDate: timestamp("end_date", { withTimezone: true, mode: "string" }),
    logoUrl: text("logo_url"),
    description: text(),
    languages: text().default("en").notNull(),
    setupCompleted: boolean("setup_completed").default(false),
    termsAndConditionsKey: text("terms_and_conditions_key"),
    mode: text().default("marathon").notNull(),
  },
  (table) => [
    index("marathons_domain_idx").using(
      "btree",
      table.domain.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const competitionClasses = pgTable(
  "competition_classes",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    name: text().notNull(),
    numberOfPhotos: integer("number_of_photos").notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    topicStartIndex: integer("topic_start_index").default(0).notNull(),
    description: text(),
  },
  (table) => [
    index("competition_classes_marathon_id_idx").using(
      "btree",
      table.marathonId.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "competition_classes_marathon_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const deviceGroups = pgTable(
  "device_groups",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    name: text().notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    icon: text().default("camera").notNull(),
    description: text(),
  },
  (table) => [
    index("device_groups_marathon_id_idx").using(
      "btree",
      table.marathonId.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "device_groups_marathon_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const participantVerifications = pgTable(
  "participant_verifications",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    participantId: bigint("participant_id", { mode: "number" }).notNull(),
    staffId: text("staff_id").notNull(),
    notes: text(),
  },
  (table) => [
    index("participant_verifications_participant_id_idx").on(
      table.participantId,
    ),
    index("participant_verifications_staff_id_idx").using(
      "btree",
      table.staffId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [user.id],
      name: "participant_verification_staff_id_fkey",
    }),
    foreignKey({
      columns: [table.participantId],
      foreignColumns: [participants.id],
      name: "participant_verifications_participant_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    participantId: bigint("participant_id", { mode: "number" }).notNull(),
    key: text().notNull(),
    thumbnailKey: text("thumbnail_key"),
    previewKey: text("preview_key"),
    exif: jsonb().$type<Record<string, unknown>>(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    size: bigint({ mode: "number" }),
    mimeType: text("mime_type"),
    topicId: bigint("topic_id", { mode: "number" }).notNull(),
    status: text().default("initialized").notNull(),
  },
  (table) => [
    index("submissions_key_idx").using(
      "btree",
      table.key.asc().nullsLast().op("text_ops"),
    ),
    index("submissions_marathon_id_idx").using(
      "btree",
      table.marathonId.asc().nullsLast().op("int8_ops"),
    ),
    index("submissions_participant_id_idx").using(
      "btree",
      table.participantId.asc().nullsLast().op("int8_ops"),
    ),
    index("submissions_topic_id_idx").on(table.topicId),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "submissions_marathon_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.participantId],
      foreignColumns: [participants.id],
      name: "submissions_participant_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.topicId],
      foreignColumns: [topics.id],
      name: "submissions_topic_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    name: text().notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    visibility: text().default("private").notNull(),
    scheduledStart: timestamp("scheduled_start", {
      withTimezone: true,
      mode: "string",
    }),
    scheduledEnd: timestamp("scheduled_end", {
      withTimezone: true,
      mode: "string",
    }),
    activatedAt: timestamp("activated_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "topics_marathon_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const zippedSubmissions = pgTable(
  "zipped_submissions",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    key: text("key").notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    participantId: bigint("participant_id", { mode: "number" }).notNull(),
  },
  (table) => [
    index("zipped_submissions_marathon_id_idx").on(table.marathonId),
    index("zipped_submissions_participant_id_idx").on(table.participantId),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "zipped_submissions_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.participantId],
      foreignColumns: [participants.id],
      name: "zipped_submissions_participant_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const contactSheets = pgTable(
  "contact_sheets",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    key: text("key").notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    participantId: bigint("participant_id", { mode: "number" }).notNull(),
  },
  (table) => [
    index("contact_sheets_marathon_id_idx").on(table.marathonId),
    index("contact_sheets_participant_id_idx").on(table.participantId),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "contact_sheets_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.participantId],
      foreignColumns: [participants.id],
      name: "contact_sheets_participant_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const user = pgTable(
  "user",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull(),
    image: text(),
    createdAt: timestamp({ mode: "string" }).notNull(),
    updatedAt: timestamp({ mode: "string" }).notNull(),
  },
  (table) => [unique("user_email_key").on(table.email)],
);

export const sponsors = pgTable(
  "sponsors",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    uploadedAt: timestamp("uploaded_at", {
      withTimezone: true,
      mode: "string",
    }),
    key: text().notNull(),
    position: text().notNull(),
    type: text().notNull(),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "sponsors_marathon_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const votingSession = pgTable(
  "voting_session",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    token: text().notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phoneHash: text("phone_hash"),
    phoneEncrypted: text("phone_encrypted"),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    notificationLastSentAt: timestamp("notification_last_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    voteSubmissionId: bigint("vote_submission_id", { mode: "number" }),
    connectedParticipantId: bigint("connected_participant_id", {
      mode: "number",
    }),
    votedAt: timestamp("voted_at", { withTimezone: true, mode: "string" }),
    topicId: bigint("topic_id", { mode: "number" }).notNull(),
  },
  (table) => [
    index("voting_session_connected_participant_id_idx").on(
      table.connectedParticipantId,
    ),
    uniqueIndex("voting_session_connected_participant_topic_unique_idx").on(
      table.connectedParticipantId,
      table.topicId,
    ),
    uniqueIndex("voting_session_token_unique_idx").on(table.token),
    index("voting_session_marathon_topic_idx").on(
      table.marathonId,
      table.topicId,
    ),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "voting_session_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.topicId],
      foreignColumns: [topics.id],
      name: "voting_session_topic_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.voteSubmissionId],
      foreignColumns: [submissions.id],
      name: "voting_session_vote_submission_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.connectedParticipantId],
      foreignColumns: [participants.id],
      name: "voting_session_connected_participant_id_fkey",
    }).onDelete("set null"),
  ],
);

export const votingRound = pgTable(
  "voting_round",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    marathonId: bigint("marathon_id", { mode: "number" }).notNull(),
    topicId: bigint("topic_id", { mode: "number" }).notNull(),
    roundNumber: integer("round_number").notNull(),
    kind: text("kind").notNull(),
    sourceRoundId: bigint("source_round_id", { mode: "number" }),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("voting_round_topic_round_number_unique_idx").on(
      table.topicId,
      table.roundNumber,
    ),
    index("voting_round_marathon_topic_idx").on(
      table.marathonId,
      table.topicId,
    ),
    index("voting_round_source_round_id_idx").on(table.sourceRoundId),
    check(
      "voting_round_kind_check",
      sql`${table.kind} in ('initial', 'tiebreak')`,
    ),
    foreignKey({
      columns: [table.marathonId],
      foreignColumns: [marathons.id],
      name: "voting_round_marathon_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.topicId],
      foreignColumns: [topics.id],
      name: "voting_round_topic_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sourceRoundId],
      foreignColumns: [table.id],
      name: "voting_round_source_round_id_fkey",
    }).onDelete("set null"),
  ],
);

export const votingRoundSubmission = pgTable(
  "voting_round_submission",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    roundId: bigint("round_id", { mode: "number" }).notNull(),
    submissionId: bigint("submission_id", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("voting_round_submission_round_submission_unique_idx").on(
      table.roundId,
      table.submissionId,
    ),
    index("voting_round_submission_round_id_idx").on(table.roundId),
    index("voting_round_submission_submission_id_idx").on(table.submissionId),
    foreignKey({
      columns: [table.roundId],
      foreignColumns: [votingRound.id],
      name: "voting_round_submission_round_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.submissionId],
      foreignColumns: [submissions.id],
      name: "voting_round_submission_submission_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const votingRoundVote = pgTable(
  "voting_round_vote",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    roundId: bigint("round_id", { mode: "number" }).notNull(),
    sessionId: bigint("session_id", { mode: "number" }).notNull(),
    submissionId: bigint("submission_id", { mode: "number" }).notNull(),
    votedAt: timestamp("voted_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("voting_round_vote_round_session_unique_idx").on(
      table.roundId,
      table.sessionId,
    ),
    index("voting_round_vote_round_submission_idx").on(
      table.roundId,
      table.submissionId,
    ),
    index("voting_round_vote_session_id_idx").on(table.sessionId),
    foreignKey({
      columns: [table.roundId],
      foreignColumns: [votingRound.id],
      name: "voting_round_vote_round_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [votingSession.id],
      name: "voting_round_vote_session_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.submissionId],
      foreignColumns: [submissions.id],
      name: "voting_round_vote_submission_id_fkey",
    }).onDelete("cascade"),
  ],
);
