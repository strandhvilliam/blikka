import { Effect, Layer, Option, ServiceMap } from "effect";
import { and, eq } from "drizzle-orm";
import { user, userMarathons } from "../schema";
import type { NewUser, NewUserMarathonRelation } from "../types";
import { DrizzleClient } from "../drizzle-client";
import { DbError } from "../utils";
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
          const result = rel.map((rel) => ({
            userId: rel.userId,
            relationId: rel.id,
            marathonId: rel.marathonId,
            domain: rel.marathon.domain,
            role: rel.role,
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
        const result = yield* use((db) =>
          db.query.user.findFirst({
            where: (table, operators) => operators.eq(table.email, email),
            with: {
              userMarathons: true,
            },
          }),
        );
        return Option.fromNullishOr(result);
      });
      const getStaffMembersByDomain = Effect.fn(
        "UsersQueries.getStaffMembersByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* use((db) =>
          db.query.marathons.findFirst({
            where: (table, operators) => operators.eq(table.domain, domain),
            with: {
              userMarathons: {
                with: {
                  user: true,
                },
              },
            },
          }),
        );
        return result?.userMarathons ?? [];
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
          const resp = {
            ...result.userMarathons[0],
            user: {
              ...result,
              participantVerifications: filteredParticipantVerifications,
            },
          };
          return Option.some(resp);
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
      return {
        getUserById,
        getUserWithMarathons,
        getMarathonsByUserId,
        getUserByEmailWithMarathons,
        getStaffMembersByDomain,
        getStaffMemberById,
        createUser,
        updateUser,
        deleteUser,
        createUserMarathonRelation,
        updateUserMarathonRelation,
        deleteUserMarathonRelation,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
