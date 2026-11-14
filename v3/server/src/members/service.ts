import { and, eq, inArray } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";

const members = model.organizationMembers;

export class MembersService extends Context.Service<MembersService>()("blikka/members/MembersService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { selectAccessibleOrganizationIds } = yield* PermissionsService;

    const list = Effect.fn("MembersService.list")(function* (caller: User, organizationId?: string) {
      return yield* Effect.promise(() =>
        db
          .select({
            user_id: members.userId,
            organization_id: members.organizationId,
            name: model.user.name,
            email: model.user.email,
            role: members.role,
          })
          .from(members)
          .innerJoin(model.user, eq(model.user.id, members.userId))
          .where(
            and(
              inArray(members.organizationId, selectAccessibleOrganizationIds(caller, "members:read")),
              organizationId ? eq(members.organizationId, organizationId) : undefined,
            ),
          )
          .orderBy(members.createdAt),
      );
    });

    return { list };
  }),
}) {
  static readonly layer = Layer.effect(MembersService, MembersService.make);
}
