import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { JUROR_TOKEN_PREFIX } from "../auth/BallotSession.ts";
import { hashToken, newToken } from "../auth/tokens.ts";
import type { User } from "../contract.ts";
import { Db } from "../db/Db.ts";
import * as model from "../db/model.ts";
import { PermissionsService } from "../permissions/service.ts";
import { RoundsService } from "../rounds/service.ts";
import { NotJuryRound, VoterAlreadyInvited, type VoterCreate, VoterNotFound } from "./schemas.ts";

const { judgingRounds: rounds, judgingVoters: voters, judgingVotes: votes } = model;

const voterParticipant = alias(model.participants, "voter_participant");

const columns = {
  id: voters.id,
  round_id: voters.roundId,
  participant_id: voters.participantId,
  name: voters.name,
  email: voters.email,
  votes: sql<number>`(select count(*)::int from ${votes} where ${votes}.voter_id = ${voters}.id)`,
  submitted_at: voters.submittedAt,
  created_at: voters.createdAt,
};

export class VotersService extends Context.Service<VotersService>()("blikka/voters/VotersService", {
  make: Effect.gen(function* () {
    const db = yield* Db;
    const { selectAccessibleOrganizationIds } = yield* PermissionsService;
    const roundsService = yield* RoundsService;

    const select = () =>
      db
        .select(columns)
        .from(voters)
        .innerJoin(rounds, eq(rounds.id, voters.roundId))
        .innerJoin(model.competitions, eq(model.competitions.id, rounds.competitionId))
        .leftJoin(voterParticipant, eq(voterParticipant.id, voters.participantId));

    const readable = (caller: User) =>
      and(
        inArray(model.competitions.organizationId, selectAccessibleOrganizationIds(caller, "judging:read")),
        isNull(model.competitions.deletedAt),
        isNull(rounds.deletedAt),
        isNull(voters.revokedAt),
        sql`(${voters.participantId} is null or ${voterParticipant.deletedAt} is null)`,
      );

    const list = Effect.fn("VotersService.list")(function* (caller: User, roundId?: string) {
      const filters = [readable(caller)];

      if (roundId) {
        filters.push(eq(voters.roundId, roundId));
      }

      return yield* Effect.promise(() =>
        select()
          .where(and(...filters))
          .orderBy(voters.roundId, voters.id),
      );
    });

    const get = Effect.fn("VotersService.get")(function* (caller: User, id: string) {
      const [voter] = yield* Effect.promise(() => select().where(and(readable(caller), eq(voters.id, id))));

      if (!voter) {
        return yield* new VoterNotFound();
      }

      return voter;
    });

    const writableJuror = Effect.fn("VotersService.writableJuror")(function* (caller: User, id: string) {
      const voter = yield* get(caller, id);
      yield* roundsService
        .writable(caller, voter.round_id)
        .pipe(Effect.catchTag("RoundNotFound", () => Effect.fail(new VoterNotFound())));

      if (voter.participant_id) {
        return yield* new VoterNotFound();
      }

      return voter;
    });

    const invite = Effect.fn("VotersService.invite")(function* (caller: User, input: VoterCreate) {
      const round = yield* roundsService.writable(caller, input.round_id);

      if (round.voters !== "jury") {
        return yield* new NotJuryRound();
      }

      const token = newToken(JUROR_TOKEN_PREFIX);
      const tokenHash = yield* Effect.promise(() => hashToken(token));

      const [created] = yield* Effect.promise(() =>
        db
          .insert(voters)
          .values({ roundId: round.id, name: input.name, email: input.email.toLowerCase(), tokenHash })
          .onConflictDoNothing()
          .returning({ id: voters.id }),
      );

      if (!created) {
        return yield* new VoterAlreadyInvited();
      }

      return { voter: yield* get(caller, created.id).pipe(Effect.orDie), token };
    });

    const renewToken = Effect.fn("VotersService.renewToken")(function* (caller: User, id: string) {
      yield* writableJuror(caller, id);

      const token = newToken(JUROR_TOKEN_PREFIX);
      const tokenHash = yield* Effect.promise(() => hashToken(token));

      yield* Effect.promise(() => db.update(voters).set({ tokenHash }).where(eq(voters.id, id)));

      return { voter: yield* get(caller, id), token };
    });

    const revoke = Effect.fn("VotersService.revoke")(function* (caller: User, id: string) {
      yield* writableJuror(caller, id);
      yield* Effect.promise(() =>
        db
          .update(voters)
          .set({ revokedAt: sql`now()`, tokenHash: null })
          .where(eq(voters.id, id)),
      );
    });

    return { list, get, invite, renewToken, revoke };
  }),
}) {
  static readonly layer = Layer.effect(VotersService, VotersService.make).pipe(Layer.provide(RoundsService.layer));
}
