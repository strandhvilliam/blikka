import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";
import { AlreadyMember, InvitationNotFound } from "./schemas.ts";

const invitations = model.organizationInvitations;

const columns = {
  id: invitations.id,
  organization_id: invitations.organizationId,
  email: invitations.email,
  expires_at: invitations.expiresAt,
};

const open = and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt));

export class InvitationsService extends Context.Service<InvitationsService>()("blikka/invitations/InvitationsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { authorize, selectAccessibleOrganizationIds } = yield* PermissionsService;

    // Expired ones included, so an admin sees who to invite again.
    const manageable = (caller: User) =>
      and(inArray(invitations.organizationId, selectAccessibleOrganizationIds(caller, "members:read")), open);

    // Only a verified email proves the address is the caller's (adr/0007).
    const addressedToCaller = (caller: User) =>
      and(
        inArray(
          invitations.email,
          db
            .select({ email: sql<string>`lower(${model.user.email})` })
            .from(model.user)
            .where(and(eq(model.user.id, caller.id), eq(model.user.emailVerified, true))),
        ),
        open,
        gt(invitations.expiresAt, sql`now()`),
        inArray(
          invitations.organizationId,
          db.select({ id: model.organizations.id }).from(model.organizations).where(isNull(model.organizations.deletedAt)),
        ),
      );

    const create = Effect.fn("InvitationsService.create")(function* (
      caller: User,
      organizationId: string,
      rawEmail: string,
    ) {
      yield* authorize(caller, "members:write", organizationId);
      const email = rawEmail.toLowerCase();
      const [member] = yield* Effect.promise(() =>
        db
          .select({ userId: model.organizationMembers.userId })
          .from(model.organizationMembers)
          .innerJoin(model.user, eq(model.user.id, model.organizationMembers.userId))
          .where(and(eq(model.organizationMembers.organizationId, organizationId), eq(sql`lower(${model.user.email})`, email))),
      );
      if (member) return yield* new AlreadyMember();
      const expiresAt = sql`now() + interval '7 days'`;
      const [invitation] = yield* Effect.promise(() =>
        db
          .insert(invitations)
          .values({ organizationId, email, invitedBy: caller.id, expiresAt })
          .onConflictDoUpdate({
            target: [invitations.organizationId, invitations.email],
            targetWhere: open,
            set: { invitedBy: caller.id, expiresAt },
          })
          .returning(columns),
      );
      // shortcut: logs instead of emailing, send it with the email service once there is one.
      yield* Effect.logInfo(
        `[invitations] ${caller.email} invited ${email} to organization ${organizationId}. They join by signing in with ${email}.`,
      );
      return invitation!;
    });

    const received = Effect.fn("InvitationsService.received")(function* (caller: User) {
      return yield* Effect.promise(() =>
        db
          .select({
            id: invitations.id,
            organization: { id: model.organizations.id, name: model.organizations.name },
            invited_by: { name: model.user.name, email: model.user.email },
            expires_at: invitations.expiresAt,
          })
          .from(invitations)
          .innerJoin(model.organizations, eq(model.organizations.id, invitations.organizationId))
          .innerJoin(model.user, eq(model.user.id, invitations.invitedBy))
          .where(addressedToCaller(caller))
          .orderBy(invitations.id),
      );
    });

    const accept = Effect.fn("InvitationsService.accept")(function* (caller: User, id: string) {
      const organizationId = yield* Effect.promise(() =>
        db.transaction(async (tx) => {
          const [invitation] = await tx
            .update(invitations)
            .set({ acceptedAt: sql`now()` })
            .where(and(eq(invitations.id, id), addressedToCaller(caller)))
            .returning({ organizationId: invitations.organizationId });
          if (!invitation) return undefined;
          await tx
            .insert(model.organizationMembers)
            .values({ organizationId: invitation.organizationId, userId: caller.id, role: "admin" })
            .onConflictDoNothing();
          return invitation.organizationId;
        }),
      );
      if (!organizationId) return yield* new InvitationNotFound();
      return { organization_id: organizationId };
    });

    const list = Effect.fn("InvitationsService.list")(function* (caller: User, organizationId?: string) {
      return yield* Effect.promise(() =>
        db
          .select(columns)
          .from(invitations)
          .where(and(manageable(caller), organizationId ? eq(invitations.organizationId, organizationId) : undefined))
          .orderBy(invitations.id),
      );
    });

    const revoke = Effect.fn("InvitationsService.revoke")(function* (caller: User, id: string) {
      const [invitation] = yield* Effect.promise(() =>
        db
          .select({ organizationId: invitations.organizationId })
          .from(invitations)
          .where(and(manageable(caller), eq(invitations.id, id))),
      );
      if (!invitation) return yield* new InvitationNotFound();
      // Not a member any more since the read: the invitation is out of reach, like any other.
      yield* authorize(caller, "members:write", invitation.organizationId).pipe(
        Effect.catchTag("OrganizationNotFound", () => Effect.fail(new InvitationNotFound())),
      );
      const [revoked] = yield* Effect.promise(() =>
        db
          .update(invitations)
          .set({ revokedAt: sql`now()` })
          .where(and(eq(invitations.id, id), open))
          .returning({ id: invitations.id }),
      );
      // Accepted or revoked by someone else since the read.
      if (!revoked) return yield* new InvitationNotFound();
    });

    return { create, received, accept, list, revoke };
  }),
}) {
  static readonly layer = Layer.effect(InvitationsService, InvitationsService.make);
}
