import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";
import {
  CompetitionHasNoTopics,
  CompetitionHasParticipants,
  CompetitionNameTaken,
  CompetitionNotFound,
  type CompetitionUpdate,
  CompetitionWindowInvalid,
  slugOf,
} from "./schemas.ts";

const columns = {
  id: model.competitions.id,
  organization_id: model.competitions.organizationId,
  slug: model.competitions.slug,
  name: model.competitions.name,
  description: model.competitions.description,
  time_zone: model.competitions.timeZone,
  published_at: model.competitions.publishedAt,
  opens_at: model.competitions.opensAt,
  closes_at: model.competitions.closesAt,
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

    // For resources under a competition, as a subquery for `inArray`.
    const selectReadableIds = (caller: User) =>
      db.select({ id: model.competitions.id }).from(model.competitions).where(readable(caller));

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

    const writable = Effect.fn("CompetitionsService.writable")(function* (caller: User, id: string) {
      const competition = yield* get(caller, id);
      yield* authorize(caller, "competitions:write", competition.organization_id).pipe(
        // Left the organization since the read.
        Effect.catchTag("OrganizationNotFound", () => Effect.fail(new CompetitionNotFound())),
      );
      return competition;
    });

    const update = Effect.fn("CompetitionsService.update")(function* (caller: User, id: string, patch: CompetitionUpdate) {
      const current = yield* writable(caller, id);
      const opensAt = patch.opens_at === undefined ? current.opens_at : patch.opens_at;
      const closesAt = patch.closes_at === undefined ? current.closes_at : patch.closes_at;
      if (opensAt && closesAt && closesAt <= opensAt) return yield* new CompetitionWindowInvalid();
      const competition = yield* Effect.promise(() =>
        db.transaction(async (tx) => {
          // Topic deletes and entries lock this row too, so neither can slip past the checks below.
          await tx.select({ id: model.competitions.id }).from(model.competitions).where(eq(model.competitions.id, id)).for("update");
          if (patch.published) {
            const [topic] = await tx
              .select({ id: model.topics.id })
              .from(model.topics)
              .where(and(eq(model.topics.competitionId, id), isNull(model.topics.deletedAt)))
              .limit(1);
            if (!topic) return "no-topics" as const;
          }
          if (patch.published === false) {
            const [participant] = await tx
              .select({ id: model.participants.id })
              .from(model.participants)
              .where(and(eq(model.participants.competitionId, id), isNull(model.participants.deletedAt)))
              .limit(1);
            if (participant) return "has-participants" as const;
          }
          const [competition] = await tx
            .update(model.competitions)
          // drizzle leaves out undefined keys, so fields not sent stay as they are.
          .set({
            name: patch.name,
            description: patch.description,
            timeZone: patch.time_zone,
            opensAt: patch.opens_at,
            closesAt: patch.closes_at,
            publishedAt:
              patch.published === undefined
                ? undefined
                : patch.published
                  ? sql`coalesce(${model.competitions.publishedAt}, now())`
                  : null,
            updatedAt: sql`now()`,
          })
          .where(and(eq(model.competitions.id, id), isNull(model.competitions.deletedAt)))
          .returning(columns);
          return competition;
        }),
      );
      if (competition === "no-topics") return yield* new CompetitionHasNoTopics();
      if (competition === "has-participants") return yield* new CompetitionHasParticipants();
      // Deleted since the check.
      if (!competition) return yield* new CompetitionNotFound();
      return competition;
    });

    const remove = Effect.fn("CompetitionsService.remove")(function* (caller: User, id: string) {
      yield* writable(caller, id);
      yield* Effect.promise(() =>
        db
          .update(model.competitions)
          .set({ deletedAt: sql`now()` })
          .where(and(eq(model.competitions.id, id), isNull(model.competitions.deletedAt))),
      );
    });

    return { list, get, create, update, remove, writable, selectReadableIds };
  }),
}) {
  static readonly layer = Layer.effect(CompetitionsService, CompetitionsService.make);
}
