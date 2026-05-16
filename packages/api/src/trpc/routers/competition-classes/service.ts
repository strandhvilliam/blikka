import { Effect, Layer, Option, Context } from "effect";
import {
  DbLayer,
  CompetitionClassesRepository,
  MarathonsRepository,
  type NewCompetitionClass,
} from "@blikka/db";
import { CompetitionClassApiError } from "./schemas";

export class CompetitionClassesApiService extends Context.Service<CompetitionClassesApiService>()(
  "@blikka/api/CompetitionClassesApiService",
  {
    make: Effect.gen(function* () {
      const marathonsRepository = yield* MarathonsRepository;
      const competitionClassesRepository = yield* CompetitionClassesRepository;

      const createCompetitionClass = Effect.fn(
        "CompetitionClassesApiService.createCompetitionClass",
      )(function* ({
        data,
        domain,
      }: {
        data: Omit<NewCompetitionClass, "marathonId">;
        domain: string;
      }) {
        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          );
        }

        return yield* competitionClassesRepository.createCompetitionClass({
          data: {
            ...data,
            marathonId: marathon.value.id,
            topicStartIndex: data.topicStartIndex ?? 0,
          },
        });
      });

      const updateCompetitionClass = Effect.fn(
        "CompetitionClassesApiService.updateCompetitionClass",
      )(function* ({
        id,
        data,
        domain,
      }: {
        id: number;
        data: Partial<NewCompetitionClass>;
        domain: string;
      }) {
        const competitionClass =
          yield* competitionClassesRepository.getCompetitionClassById({
            id,
          });

        if (Option.isNone(competitionClass)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class not found with id ${id}`,
            }),
          );
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (
          Option.isNone(marathon) ||
          marathon.value.id !== competitionClass.value.marathonId
        ) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class does not belong to domain ${domain}`,
            }),
          );
        }

        return yield* competitionClassesRepository.updateCompetitionClass({
          id,
          data,
        });
      });

      const deleteCompetitionClass = Effect.fn(
        "CompetitionClassesApiService.deleteCompetitionClass",
      )(function* ({ id, domain }: { id: number; domain: string }) {
        const competitionClass =
          yield* competitionClassesRepository.getCompetitionClassById({
            id,
          });

        if (Option.isNone(competitionClass)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class not found with id ${id}`,
            }),
          );
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (
          Option.isNone(marathon) ||
          marathon.value.id !== competitionClass.value.marathonId
        ) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class does not belong to domain ${domain}`,
            }),
          );
        }

        return yield* competitionClassesRepository.deleteCompetitionClass({
          id,
        });
      });

      return {
        createCompetitionClass,
        updateCompetitionClass,
        deleteCompetitionClass,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DbLayer),
  );
}
