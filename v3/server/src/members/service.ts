import { TransactionRollbackError, and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionDenied } from "../permissions/permissions.ts";
import { PermissionsService } from "../permissions/service.ts";
import { MemberNotFound, OwnerCannotBeRemoved } from "./schemas.ts";

const members = model.organizationMembers;

const columns = {
  user_id: members.userId,
  organization_id: members.organizationId,
  name: model.user.name,
  email: model.user.email,
  role: members.role,
};

const membership = (organizationId: string, userId: string) =>
  and(eq(members.organizationId, organizationId), eq(members.userId, userId), isNull(members.deletedAt));

export class MembersService extends Context.Service<MembersService>()("blikka/members/MembersService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { authorize, selectAccessibleOrganizationIds } = yield* PermissionsService;

    const select = (caller: User, where: ReturnType<typeof and>) =>
      db
        .select(columns)
        .from(members)
        .innerJoin(model.user, eq(model.user.id, members.userId))
        .where(
          and(
            inArray(members.organizationId, selectAccessibleOrganizationIds(caller, "members:read")),
            isNull(members.deletedAt),
            where,
          ),
        );

    const list = Effect.fn("MembersService.list")(function* (caller: User, organizationId?: string) {
      return yield* Effect.promise(() =>
        select(caller, organizationId ? eq(members.organizationId, organizationId) : undefined).orderBy(
          members.createdAt,
        ),
      );
    });

    const get = Effect.fn("MembersService.get")(function* (caller: User, organizationId: string, userId: string) {
      const [member] = yield* Effect.promise(() => select(caller, membership(organizationId, userId)));
      if (!member) return yield* new MemberNotFound();
      return member;
    });

    // Not a member any more since the read: the member is out of reach, like any other.
    const authorizeWrite = (caller: User, organizationId: string) =>
      authorize(caller, "members:write", organizationId).pipe(
        Effect.catchTag("OrganizationNotFound", () => Effect.fail(new MemberNotFound())),
      );

    // Removing yourself is leaving, which needs no permission.
    const remove = Effect.fn("MembersService.remove")(function* (caller: User, organizationId: string, userId: string) {
      const member = yield* get(caller, organizationId, userId);
      if (member.role === "owner") return yield* new OwnerCannotBeRemoved();
      if (userId !== caller.id) yield* authorizeWrite(caller, organizationId);
      const [removed] = yield* Effect.promise(() =>
        db
          .update(members)
          .set({ deletedAt: sql`now()` })
          // Not the owner: a transfer may have made them owner since the read.
          .where(and(membership(organizationId, userId), ne(members.role, "owner")))
          .returning({ userId: members.userId }),
      );
      if (!removed) return yield* new MemberNotFound();
    });

    // The owner hands ownership to another member and becomes an admin. Nobody changes their own role (adr/0001).
    const transferOwnership = Effect.fn("MembersService.transferOwnership")(function* (
      caller: User,
      organizationId: string,
      userId: string,
    ) {
      yield* get(caller, organizationId, userId);
      const { role } = yield* authorizeWrite(caller, organizationId);
      if (role !== "owner" || userId === caller.id) return yield* new PermissionDenied();
      const outcome = yield* Effect.promise(() =>
        db
          .transaction(async (tx) => {
            // Demote first: the index allows one owner at a time.
            const [demoted] = await tx
              .update(members)
              .set({ role: "admin" })
              .where(and(membership(organizationId, caller.id), eq(members.role, "owner")))
              .returning({ userId: members.userId });
            if (!demoted) return "denied" as const;
            const [promoted] = await tx
              .update(members)
              .set({ role: "owner" })
              .where(membership(organizationId, userId))
              .returning({ userId: members.userId });
            // Removed since the read: undo the demotion, so the organization keeps its owner.
            if (!promoted) tx.rollback();
            return "done" as const;
          })
          .catch((error) => {
            if (error instanceof TransactionRollbackError) return "gone" as const;
            throw error;
          }),
      );
      if (outcome === "denied") return yield* new PermissionDenied();
      if (outcome === "gone") return yield* new MemberNotFound();
      return yield* get(caller, organizationId, userId);
    });

    return { list, remove, transferOwnership };
  }),
}) {
  static readonly layer = Layer.effect(MembersService, MembersService.make);
}
