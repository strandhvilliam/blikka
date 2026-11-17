import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";

const { submissions, participants } = model;

export class SubmissionsService extends Context.Service<SubmissionsService>()("blikka/submissions/SubmissionsService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { selectAccessibleOrganizationIds } = yield* PermissionsService;

    const list = Effect.fn("SubmissionsService.list")(function* (caller: User, participantId?: string) {
      const organizationIds = selectAccessibleOrganizationIds(caller, "submissions:read");

      const competitions = db
        .select({ id: model.competitions.id })
        .from(model.competitions)
        .where(and(inArray(model.competitions.organizationId, organizationIds), isNull(model.competitions.deletedAt)));

      const filters = [inArray(participants.competitionId, competitions), isNull(participants.deletedAt)];

      if (participantId) {
        filters.push(eq(submissions.participantId, participantId));
      }

      return yield* Effect.promise(() =>
        db
          .select({
            id: submissions.id,
            participant_id: submissions.participantId,
            topic_id: submissions.topicId,
            created_at: submissions.createdAt,
            updated_at: submissions.updatedAt,
          })
          .from(submissions)
          .innerJoin(participants, eq(participants.id, submissions.participantId))
          .where(and(...filters))
          .orderBy(submissions.id),
      );
    });

    return { list };
  }),
}) {
  static readonly layer = Layer.effect(SubmissionsService, SubmissionsService.make);
}
