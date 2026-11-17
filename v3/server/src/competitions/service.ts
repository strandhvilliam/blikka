import { and, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db, transaction } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";
import {
  type CompetitionCreate,
  CompetitionHasNoTopics,
  CompetitionHasParticipants,
  CompetitionNameTaken,
  CompetitionNotFound,
  type CompetitionUpdate,
  CompetitionWindowInvalid,
  slugOf,
  TimeLimitNeedsSequence,
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
  topics_in_sequence: model.competitions.topicsInSequence,
  minutes_per_topic: model.competitions.minutesPerTopic,
};

export class CompetitionsService extends Context.Service<CompetitionsService>()(
  "blikka/competitions/CompetitionsService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const { authorize, selectAccessibleOrganizationIds } = yield* PermissionsService;

      const readable = (caller: User) =>
        and(
          inArray(model.competitions.organizationId, selectAccessibleOrganizationIds(caller, "competitions:read")),
          isNull(model.competitions.deletedAt),
        );

      const selectReadableIds = (caller: User) =>
        db.select({ id: model.competitions.id }).from(model.competitions).where(readable(caller));

      const list = Effect.fn("CompetitionsService.list")(function* (caller: User, organizationId?: string) {
        const filters = [readable(caller)];

        if (organizationId) {
          filters.push(eq(model.competitions.organizationId, organizationId));
        }

        return yield* Effect.promise(() =>
          db
            .select(columns)
            .from(model.competitions)
            .where(and(...filters))
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

        if (!competition) {
          return yield* new CompetitionNotFound();
        }

        return competition;
      });

      const create = Effect.fn("CompetitionsService.create")(function* (caller: User, input: CompetitionCreate) {
        yield* authorize(caller, "competitions:write", input.organization_id);

        const [competition] = yield* Effect.promise(() =>
          db
            .insert(model.competitions)
            .values({
              organizationId: input.organization_id,
              name: input.name,
              slug: slugOf(input.name),
              timeZone: input.time_zone,
            })
            .onConflictDoNothing({ target: model.competitions.slug })
            .returning(columns),
        );

        if (!competition) {
          return yield* new CompetitionNameTaken();
        }

        return competition;
      });

      const writable = Effect.fn("CompetitionsService.writable")(function* (caller: User, id: string) {
        const competition = yield* get(caller, id);
        yield* authorize(caller, "competitions:write", competition.organization_id).pipe(
          Effect.catchTag("OrganizationNotFound", () => Effect.fail(new CompetitionNotFound())),
        );

        return competition;
      });

      const update = Effect.fn("CompetitionsService.update")(function* (
        caller: User,
        id: string,
        patch: CompetitionUpdate,
      ) {
        const current = yield* writable(caller, id);
        const opensAt = patch.opens_at === undefined ? current.opens_at : patch.opens_at;
        const closesAt = patch.closes_at === undefined ? current.closes_at : patch.closes_at;

        if (opensAt && closesAt && closesAt <= opensAt) {
          return yield* new CompetitionWindowInvalid();
        }

        const inSequence = patch.topics_in_sequence ?? current.topics_in_sequence;

        const minutesPerTopic =
          patch.minutes_per_topic === undefined ? current.minutes_per_topic : patch.minutes_per_topic;

        if (minutesPerTopic !== null && !inSequence) {
          return yield* new TimeLimitNeedsSequence();
        }

        let publishedAt: SQL | null | undefined;

        if (patch.published === true) {
          publishedAt = sql`coalesce(${model.competitions.publishedAt}, now())`;
        } else if (patch.published === false) {
          publishedAt = null;
        }

        return yield* transaction(db, (tx) =>
          Effect.gen(function* () {
            const [locked] = yield* Effect.promise(() =>
              tx
                .select({ slug: model.competitions.slug, publishedAt: model.competitions.publishedAt })
                .from(model.competitions)
                .where(eq(model.competitions.id, id))
                .for("update"),
            );

            const renamedSlug = patch.name === undefined ? undefined : slugOf(patch.name);
            let slug: string | undefined;

            if (renamedSlug && locked && locked.publishedAt === null && renamedSlug !== locked.slug) {
              const [taken] = yield* Effect.promise(() =>
                tx
                  .select({ id: model.competitions.id })
                  .from(model.competitions)
                  .where(eq(model.competitions.slug, renamedSlug)),
              );

              if (taken) {
                return yield* new CompetitionNameTaken();
              }

              slug = renamedSlug;
            }

            if (patch.published) {
              const [topic] = yield* Effect.promise(() =>
                tx
                  .select({ id: model.topics.id })
                  .from(model.topics)
                  .where(and(eq(model.topics.competitionId, id), isNull(model.topics.deletedAt)))
                  .limit(1),
              );

              if (!topic) {
                return yield* new CompetitionHasNoTopics();
              }
            }

            if (patch.published === false) {
              const [participant] = yield* Effect.promise(() =>
                tx
                  .select({ id: model.participants.id })
                  .from(model.participants)
                  .where(and(eq(model.participants.competitionId, id), isNull(model.participants.deletedAt)))
                  .limit(1),
              );

              if (participant) {
                return yield* new CompetitionHasParticipants();
              }
            }

            const [competition] = yield* Effect.promise(() =>
              tx
                .update(model.competitions)
                .set({
                  name: patch.name,
                  slug,
                  description: patch.description,
                  timeZone: patch.time_zone,
                  opensAt: patch.opens_at,
                  closesAt: patch.closes_at,
                  topicsInSequence: patch.topics_in_sequence,
                  minutesPerTopic: patch.minutes_per_topic,
                  publishedAt,
                  updatedAt: sql`now()`,
                })
                .where(and(eq(model.competitions.id, id), isNull(model.competitions.deletedAt)))
                .returning(columns),
            );

            if (!competition) {
              return yield* new CompetitionNotFound();
            }

            return competition;
          }),
        );
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
  },
) {
  static readonly layer = Layer.effect(CompetitionsService, CompetitionsService.make);
}
