import { gt, isNull, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  platformRole: text().notNull().default("user"),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const otpSends = pgTable("otp_sends", {
  email: text().primaryKey(),
  count: integer().notNull(),
  windowStart: timestamp().notNull(),
});

export const organizations = pgTable("organizations", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  name: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  deletedAt: timestamp(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    role: text().$type<"owner" | "admin">().notNull().default("admin"),
    createdAt: timestamp().notNull().defaultNow(),
    deletedAt: timestamp(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("organization_members_user_id_idx").on(table.userId),
    uniqueIndex("organization_members_one_owner")
      .on(table.organizationId)
      .where(sql`${table.role} = 'owner' and ${table.deletedAt} is null`),
  ],
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    email: text().notNull(),
    invitedBy: uuid()
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp().notNull(),
    acceptedAt: timestamp(),
    revokedAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_invitations_open_unique")
      .on(table.organizationId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index("organization_invitations_email_idx").on(table.email),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    slug: text().notNull().unique(),
    name: text().notNull(),
    description: text().notNull().default(""),
    timeZone: text().notNull().default("Europe/Stockholm"),
    publishedAt: timestamp({ withTimezone: true }),
    opensAt: timestamp({ withTimezone: true }),
    closesAt: timestamp({ withTimezone: true }),
    topicsInSequence: boolean().notNull().default(false),
    minutesPerTopic: integer(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    deletedAt: timestamp(),
  },
  (table) => [
    index("competitions_organization_id_idx").on(table.organizationId),
    check("competitions_window_check", gt(table.closesAt, table.opensAt)),
    check(
      "competitions_minutes_per_topic_check",
      sql`${table.minutesPerTopic} is null or (${table.topicsInSequence} and ${table.minutesPerTopic} between 1 and 1440)`,
    ),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    competitionId: uuid()
      .notNull()
      .references(() => competitions.id),
    name: text().notNull(),
    position: integer().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    deletedAt: timestamp(),
  },
  (table) => [index("topics_competition_id_idx").on(table.competitionId)],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    competitionId: uuid()
      .notNull()
      .references(() => competitions.id),
    userId: uuid().references(() => user.id, { onDelete: "set null" }),
    name: text().notNull(),
    email: text().notNull(),
    guestTokenHash: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    deletedAt: timestamp(),
  },
  (table) => [
    uniqueIndex("participants_competition_id_email_unique")
      .on(table.competitionId, table.email)
      .where(isNull(table.deletedAt)),
    uniqueIndex("participants_competition_id_user_id_unique")
      .on(table.competitionId, table.userId)
      .where(sql`${table.userId} is not null and ${table.deletedAt} is null`),
    index("participants_user_id_idx").on(table.userId),
    index("participants_email_idx").on(table.email),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    participantId: uuid()
      .notNull()
      .references(() => participants.id),
    topicId: uuid()
      .notNull()
      .references(() => topics.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("submissions_participant_id_topic_id_unique").on(table.participantId, table.topicId),
    index("submissions_topic_id_idx").on(table.topicId),
  ],
);
