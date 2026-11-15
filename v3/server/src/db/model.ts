import { sql } from 'drizzle-orm'
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
} from 'drizzle-orm/pg-core'

// Better Auth core tables. Column names follow Better Auth's field names so the adapter maps 1:1.

export const user = pgTable('user', {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  // 'user' | 'superadmin'. Set by hand in the DB, never through the auth API (input: false).
  platformRole: text().notNull().default('user'),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const session = pgTable(
  'session',
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
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
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
  (table) => [index('account_user_id_idx').on(table.userId)],
)

export const verification = pgTable(
  'verification',
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
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

// Sign-in codes sent to an email in its current hour. Auth.ts caps it, so a stranger can't keep
// asking for new codes to guess at.
// shortcut: one row per address ever asked for a code, never deleted; prune rows older than an hour once it grows.
export const otpSends = pgTable('otp_sends', {
  email: text().primaryKey(),
  count: integer().notNull(),
  windowStart: timestamp().notNull(),
})

export const organizations = pgTable('organizations', {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  name: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  deletedAt: timestamp(),
})

// Users who run an organization, not participants.
export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    role: text().$type<'owner' | 'admin'>().notNull().default('admin'),
    createdAt: timestamp().notNull().defaultNow(),
    // Removed or left. Joining again clears it (adr/0008).
    deletedAt: timestamp(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index('organization_members_user_id_idx').on(table.userId),
    // Exactly one owner (adr/0001); a transfer demotes before it promotes.
    uniqueIndex('organization_members_one_owner')
      .on(table.organizationId)
      .where(sql`${table.role} = 'owner' and ${table.deletedAt} is null`),
  ],
)

// No token: whoever signs in with this verified email accepts it (adr/0007-organization-invitations.md).
export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    // Lowercase.
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
    uniqueIndex('organization_invitations_open_unique')
      .on(table.organizationId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index('organization_invitations_email_idx').on(table.email),
  ],
)

export const competitions = pgTable(
  'competitions',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    slug: text().notNull().unique(),
    name: text().notNull(),
    description: text().notNull().default(''),
    timeZone: text().notNull().default('Europe/Stockholm'),
    // Null is a draft participants can't see or enter (adr/0009).
    publishedAt: timestamp({ withTimezone: true }),
    // Null opensAt: not open yet. Null closesAt: no deadline.
    opensAt: timestamp({ withTimezone: true }),
    closesAt: timestamp({ withTimezone: true }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    deletedAt: timestamp(),
  },
  (table) => [
    index('competitions_organization_id_idx').on(table.organizationId),
    // The service checks this first; the constraint catches two edits racing.
    check('competitions_window_check', sql`${table.closesAt} > ${table.opensAt}`),
  ],
)

export const topics = pgTable(
  'topics',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    competitionId: uuid()
      .notNull()
      .references(() => competitions.id),
    name: text().notNull(),
    // 1..n among the competition's live topics, renumbered on delete and move. Not unique, since
    // Postgres checks that per row while a move shifts its neighbours.
    position: integer().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    deletedAt: timestamp(),
  },
  (table) => [index('topics_competition_id_idx').on(table.competitionId)],
)

export const participants = pgTable(
  'participants',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    competitionId: uuid()
      .notNull()
      .references(() => competitions.id),
    // Null for guests; set when they sign in with the same verified email.
    userId: uuid().references(() => user.id, { onDelete: 'set null' }),
    // Copied from the account on entry, so guests and users read the same.
    name: text().notNull(),
    email: text().notNull(),
    reference: text().notNull(),
    status: text().notNull().default('initialized'),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    deletedAt: timestamp(),
  },
  (table) => [
    unique('participants_competition_id_email_unique').on(table.competitionId, table.email),
    unique('participants_competition_id_reference_unique').on(table.competitionId, table.reference),
    index('participants_user_id_idx').on(table.userId),
    index('participants_email_idx').on(table.email),
  ],
)
