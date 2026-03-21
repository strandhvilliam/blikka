import { Effect, Layer, Option, ServiceMap } from "effect";
import { and, desc, eq, sql } from "drizzle-orm";
import { pendingUserMarathons, user, userMarathons } from "../schema";
import type {
  NewPendingUserMarathonRelation,
  NewUser,
  NewUserMarathonRelation,
} from "../types";
import { DrizzleClient } from "../drizzle-client";
import { DbError, normalizeEmail } from "../utils";

type ActiveStaffAccess = {
  kind: "active";
  id: `u:${string}`;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  status: "active";
};

type PendingStaffAccess = {
  kind: "pending";
  id: `p:${number}`;
  pendingId: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  status: "pending";
};

export class UsersQueries extends ServiceMap.Service<UsersQueries>()(
  "@blikka/db/users-queries",
  {
    make: Effect.gen(function* () {
      const { use } = yield* DrizzleClient;

      const getUserPermissions = Effect.fn("UsersQueries.getUserPermissions")(
        function* ({ userId }: { userId: string }) {
          const rel = yield* use((db) =>
            db.query.userMarathons.findMany({
              where: (table, operators) => operators.eq(table.userId, userId),
              with: {
                marathon: true,
              },
            }),
          );

          return rel.map((row) => ({
            userId: row.userId,
            relationId: row.id,
            marathonId: row.marathonId,
            domain: row.marathon.domain,
            role: row.role,
          }));
        },
      );

      const getUserById = Effect.fn("UsersQueries.getUserById")(function* ({
        id,
      }: {
        id: string;
      }) {
        const result = yield* use((db) =>
          db.query.user.findFirst({
            where: (table, operators) => operators.eq(table.id, id),
          }),
        );

        return Option.fromNullishOr(result);
      });

      const getUserWithMarathons = Effect.fn(
        "UsersQueries.getUserWithMarathons",
      )(function* ({ userId }: { userId: string }) {
        const result = yield* use((db) =>
          db.query.user.findFirst({
            where: (table, operators) => operators.eq(table.id, userId),
            with: {
              userMarathons: {
                with: {
                  marathon: true,
                },
              },
            },
          }),
        );

        return Option.fromNullishOr(result);
      });

      const getMarathonsByUserId = Effect.fn(
        "UsersQueries.getMarathonsByUserId",
      )(function* ({ userId }: { userId: string }) {
        const result = yield* use((db) =>
          db.query.userMarathons.findMany({
            where: (table, operators) => operators.eq(table.userId, userId),
            with: {
              marathon: true,
            },
          }),
        );

        return result.map((userMarathon) => userMarathon.marathon);
      });

      const getUserByEmailWithMarathons = Effect.fn(
        "UsersQueries.getUserByEmailWithMarathons",
      )(function* ({ email }: { email: string }) {
        const normalizedEmail = normalizeEmail(email);
        const result = yield* use((db) =>
          db.query.user.findFirst({
            where: sql`lower(${user.email}) = ${normalizedEmail}`,
            with: {
              userMarathons: true,
            },
          }),
        );

        return Option.fromNullishOr(result);
      });

      const getUserByNormalizedEmail = Effect.fn(
        "UsersQueries.getUserByNormalizedEmail",
      )(function* ({ emailNormalized }: { emailNormalized: string }) {
        const result = yield* use((db) =>
          db.query.user.findFirst({
            where: sql`lower(${user.email}) = ${emailNormalized}`,
          }),
        );

        return Option.fromNullishOr(result);
      });

      const getPendingUserMarathonsByEmailNormalized = Effect.fn(
        "UsersQueries.getPendingUserMarathonsByEmailNormalized",
      )(function* ({ emailNormalized }: { emailNormalized: string }) {
        return yield* use((db) =>
          db.query.pendingUserMarathons.findMany({
            where: (table, operators) =>
              operators.eq(table.emailNormalized, emailNormalized),
            orderBy: (table) => [desc(table.createdAt)],
          }),
        );
      });

      const getPendingUserMarathonsByDomain = Effect.fn(
        "UsersQueries.getPendingUserMarathonsByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              pendingUserMarathons: {
                orderBy: (table) => [desc(table.createdAt)],
              },
            },
          }),
        );

        return result?.pendingUserMarathons ?? [];
      });

      const getPendingUserMarathonById = Effect.fn(
        "UsersQueries.getPendingUserMarathonById",
      )(function* ({ pendingId, domain }: { pendingId: number; domain: string }) {
        const result = yield* use((db) =>
          db.query.pendingUserMarathons.findFirst({
            where: (table, operators) =>
              operators.eq(table.id, pendingId),
            with: {
              marathon: true,
            },
          }),
        );

        if (!result || result.marathon.domain !== domain) {
          return yield* Option.none();
        }

        return Option.some(result);
      });

      const getStaffMembersByDomain = Effect.fn(
        "UsersQueries.getStaffMembersByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              userMarathons: {
                orderBy: (table) => [desc(table.createdAt)],
                with: {
                  user: true,
                },
              },
              pendingUserMarathons: {
                orderBy: (table) => [desc(table.createdAt)],
              },
            },
          }),
        );

        if (!result) {
          return [];
        }

        const activeStaff: ActiveStaffAccess[] = result.userMarathons.map(
          (staff) => ({
            kind: "active",
            id: `u:${staff.userId}`,
            userId: staff.userId,
            name: staff.user.name,
            email: staff.user.email,
            role: staff.role,
            createdAt: staff.createdAt,
            status: "active",
          }),
        );

        const pendingStaff: PendingStaffAccess[] = result.pendingUserMarathons.map(
          (staff) => ({
            kind: "pending",
            id: `p:${staff.id}`,
            pendingId: staff.id,
            name: staff.name,
            email: staff.email,
            role: staff.role,
            createdAt: staff.createdAt,
            status: "pending",
          }),
        );

        return [...activeStaff, ...pendingStaff];
      });

      const getStaffMemberById = Effect.fn("UsersQueries.getStaffMemberById")(
        function* ({ staffId, domain }: { staffId: string; domain: string }) {
          const marathon = yield* use((db) =>
            db.query.marathons.findFirst({
              where: (table, operators) => operators.eq(table.domain, domain),
              columns: { id: true },
            }),
          );

          if (!marathon) {
            return yield* Option.none();
          }

          const result = yield* use((db) =>
            db.query.user.findFirst({
              where: (table, operators) => operators.eq(table.id, staffId),
              with: {
                userMarathons: {
                  where: (table, operators) =>
                    operators.eq(table.marathonId, marathon.id),
                },
                participantVerifications: {
                  with: {
                    participant: true,
                  },
                },
              },
            }),
          );

          if (!result?.userMarathons[0]) {
            return yield* Option.none();
          }

          const filteredParticipantVerifications =
            result.participantVerifications.filter(
              (pv) => pv.participant.marathonId === marathon.id,
            );

          return Option.some({
            ...result.userMarathons[0],
            user: {
              ...result,
              participantVerifications: filteredParticipantVerifications,
            },
          });
        },
      );

      const createUser = Effect.fn("UsersQueries.createUser")(function* ({
        data,
      }: {
        data: NewUser;
      }) {
        const [result] = yield* use((db) =>
          db.insert(user).values(data).returning(),
        );

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to create user",
            }),
          );
        }

        return result;
      });

      const updateUser = Effect.fn("UsersQueries.updateUser")(function* ({
        id,
        data,
      }: {
        id: string;
        data: Partial<NewUser>;
      }) {
        const [result] = yield* use((db) =>
          db.update(user).set(data).where(eq(user.id, id)).returning(),
        );

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update user",
            }),
          );
        }

        return result;
      });

      const deleteUser = Effect.fn("UsersQueries.deleteUser")(function* ({
        id,
      }: {
        id: string;
      }) {
        const [result] = yield* use((db) =>
          db.delete(user).where(eq(user.id, id)).returning(),
        );

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to delete user",
            }),
          );
        }

        return result;
      });

      const createUserMarathonRelation = Effect.fn(
        "UsersQueries.createUserMarathonRelation",
      )(function* ({ data }: { data: NewUserMarathonRelation }) {
        const [result] = yield* use((db) =>
          db.insert(userMarathons).values(data).returning(),
        );

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to create user marathon relation",
            }),
          );
        }

        return result;
      });

      const upsertUserMarathonRelation = Effect.fn(
        "UsersQueries.upsertUserMarathonRelation",
      )(function* ({ data }: { data: NewUserMarathonRelation }) {
        const result = yield* use((db) =>
          db
            .insert(userMarathons)
            .values(data)
            .onConflictDoUpdate({
              target: [userMarathons.marathonId, userMarathons.userId],
              set: {
                role: data.role ?? "staff",
              },
            })
            .returning(),
        );

        return result[0]!;
      });

      const updateUserMarathonRelation = Effect.fn(
        "UsersQueries.updateUserMarathonRelation",
      )(function* ({
        userId,
        marathonId,
        data,
      }: {
        userId: string;
        marathonId: number;
        data: Partial<Pick<NewUserMarathonRelation, "role">>;
      }) {
        const [result] = yield* use((db) =>
          db
            .update(userMarathons)
            .set(data)
            .where(
              and(
                eq(userMarathons.userId, userId),
                eq(userMarathons.marathonId, marathonId),
              ),
            )
            .returning(),
        );

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update user marathon relation",
            }),
          );
        }

        return result;
      });

      const deleteUserMarathonRelation = Effect.fn(
        "UsersQueries.deleteUserMarathonRelation",
      )(function* ({
        userId,
        marathonId,
      }: {
        userId: string;
        marathonId: number;
      }) {
        const [result] = yield* use((db) =>
          db
            .delete(userMarathons)
            .where(
              and(
                eq(userMarathons.userId, userId),
                eq(userMarathons.marathonId, marathonId),
              ),
            )
            .returning(),
        );

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to delete user marathon relation",
            }),
          );
        }

        return result;
      });

      const upsertPendingUserMarathon = Effect.fn(
        "UsersQueries.upsertPendingUserMarathon",
      )(function* ({
        data,
      }: {
        data: NewPendingUserMarathonRelation;
      }) {
        const normalizedEmail = normalizeEmail(data.email);
        const result = yield* use((db) =>
          db
            .insert(pendingUserMarathons)
            .values({
              ...data,
              email: data.email.trim(),
              emailNormalized: normalizedEmail,
            })
            .onConflictDoUpdate({
              target: [
                pendingUserMarathons.marathonId,
                pendingUserMarathons.emailNormalized,
              ],
              set: {
                email: data.email.trim(),
                emailNormalized: normalizedEmail,
                name: data.name,
                role: data.role ?? "staff",
                invitedByUserId: data.invitedByUserId ?? null,
                updatedAt: new Date().toISOString(),
              },
            })
            .returning(),
        );

        return result[0]!;
      });

      const updatePendingUserMarathon = Effect.fn(
        "UsersQueries.updatePendingUserMarathon",
      )(function* ({
        id,
        data,
      }: {
        id: number;
        data: Partial<NewPendingUserMarathonRelation>;
      }) {
        const nextEmail = data.email ? data.email.trim() : undefined;
        const [result] = yield* use((db) =>
          db
            .update(pendingUserMarathons)
            .set({
              ...data,
              email: nextEmail,
              emailNormalized: nextEmail
                ? normalizeEmail(nextEmail)
                : data.emailNormalized,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(pendingUserMarathons.id, id))
            .returning(),
        );

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update pending user marathon relation",
            }),
          );
        }

        return result;
      });

      const deletePendingUserMarathon = Effect.fn(
        "UsersQueries.deletePendingUserMarathon",
      )(function* ({ id }: { id: number }) {
        const [result] = yield* use((db) =>
          db.delete(pendingUserMarathons).where(eq(pendingUserMarathons.id, id)).returning(),
        );

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to delete pending user marathon relation",
            }),
          );
        }

        return result;
      });

      const claimPendingUserMarathonsForUser = Effect.fn(
        "UsersQueries.claimPendingUserMarathonsForUser",
      )(function* ({
        userId,
        email,
      }: {
        userId: string;
        email: string;
      }) {
        const emailNormalized = normalizeEmail(email);
        const pendingRelations = yield* use((db) =>
          db.query.pendingUserMarathons.findMany({
            where: (table, operators) =>
              operators.eq(table.emailNormalized, emailNormalized),
          }),
        );

        if (!pendingRelations.length) {
          return [];
        }

        const claimedRelations: typeof pendingRelations = [];

        for (const pendingRelation of pendingRelations) {
          yield* use((db) =>
            db
              .insert(userMarathons)
              .values({
                userId,
                marathonId: pendingRelation.marathonId,
                role: pendingRelation.role,
              })
              .onConflictDoUpdate({
                target: [userMarathons.marathonId, userMarathons.userId],
                set: {
                  role: pendingRelation.role,
                },
              }),
          );

          yield* use((db) =>
            db
              .delete(pendingUserMarathons)
              .where(eq(pendingUserMarathons.id, pendingRelation.id)),
          );

          claimedRelations.push(pendingRelation);
        }

        return claimedRelations;
      });

      return {
        getUserPermissions,
        getUserById,
        getUserWithMarathons,
        getMarathonsByUserId,
        getUserByEmailWithMarathons,
        getUserByNormalizedEmail,
        getPendingUserMarathonsByEmailNormalized,
        getPendingUserMarathonsByDomain,
        getPendingUserMarathonById,
        getStaffMembersByDomain,
        getStaffMemberById,
        createUser,
        updateUser,
        deleteUser,
        createUserMarathonRelation,
        upsertUserMarathonRelation,
        updateUserMarathonRelation,
        deleteUserMarathonRelation,
        upsertPendingUserMarathon,
        updatePendingUserMarathon,
        deletePendingUserMarathon,
        claimPendingUserMarathonsForUser,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
