import "server-only";

import { Effect, Schema } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../root";
import { trpcEffect } from "../utils";
import {
  CreateCompetitionClassInputSchema,
  UpdateCompetitionClassInputSchema,
  DeleteCompetitionClassInputSchema,
} from "../../core/competition-classes/contracts";
import { CompetitionClassesService } from "../../core/competition-classes/service";

export const competitionClassesRouter = createTRPCRouter({
  create: domainProcedure
    .input(Schema.toStandardSchemaV1(CreateCompetitionClassInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("CompetitionClassesRouter.create")(function* ({ input }) {
          return yield* CompetitionClassesService.use((s) =>
            s.createCompetitionClass({
              data: input.data,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  update: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateCompetitionClassInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("CompetitionClassesRouter.update")(function* ({ input }) {
          return yield* CompetitionClassesService.use((s) =>
            s.updateCompetitionClass({
              id: input.id,
              data: input.data,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  delete: domainProcedure
    .input(Schema.toStandardSchemaV1(DeleteCompetitionClassInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("CompetitionClassesRouter.delete")(function* ({ input }) {
          return yield* CompetitionClassesService.use((s) =>
            s.deleteCompetitionClass({
              id: input.id,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),
});
