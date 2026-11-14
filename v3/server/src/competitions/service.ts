import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";
import { CompetitionNameTaken, CompetitionNotFound, slugOf } from "./schemas.ts";

const columns = {
  id: model.competitions.id,
  organization_id: model.competitions.organizationId,
  slug: model.competitions.slug,
  name: model.competitions.name,
};

export class CompetitionsService extends Context.Service<CompetitionsService>()("blikka/competitions/CompetitionsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { authorize, selectAccessibleOrganizationIds } = yield* PermissionsService;

    // Every read starts here, so filters can only narrow what the caller may see.
    const readable = (caller: User) =>
      and(
        inArray(model.competitions.organizationId, selectAccessibleOrganizationIds(caller, "competitions:read")),
        isNull(model.competitions.deletedAt),
      );

    const list = Effect.fn("CompetitionsService.list")(function* (caller: User, organizationId?: string) {
      return yield* Effect.promise(() =>
        db
          .select(columns)
          .from(model.competitions)
          .where(
            and(readable(caller), organizationId ? eq(model.competitions.organizationId, organizationId) : undefined),
          )
          // uuidv7 ids sort by creation time.
          .orderBy(model.competitions.id),
      );
    });

    const get = Effect.fn("CompetitionsService.get")(function* (caller: User, id: string) {
      const [competition] = yield* Effect.promise(() =>
        db
          .select(columns)
          .from(model.competitions)
          .where(and(readable(caller), eq(model.competitions.id, id))),
      );
      if (!competition) return yield* new CompetitionNotFound();
      return competition;
    });

    const create = Effect.fn("CompetitionsService.create")(function* (caller: User, organizationId: string, name: string) {
      yield* authorize(caller, "competitions:write", organizationId);
      const [competition] = yield* Effect.promise(() =>
        db
          .insert(model.competitions)
          .values({ organizationId, name, slug: slugOf(name) })
          .onConflictDoNothing({ target: model.competitions.slug })
          .returning(columns),
      );
      if (!competition) return yield* new CompetitionNameTaken();
      return competition;
    });

    return { list, get, create };
  }),
}) {
  static readonly layer = Layer.effect(CompetitionsService, CompetitionsService.make);
}
