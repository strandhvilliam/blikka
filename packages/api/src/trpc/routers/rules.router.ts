import "server-only";

import { Effect, Schema } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../root";
import { trpcEffect } from "../utils";
import { GetByDomainInputSchema, UpdateMultipleInputSchema } from "../../core/rules/contracts";
import { RulesService } from "../../core/rules/service";

export const rulesRouter = createTRPCRouter({
  getByDomain: domainProcedure
    .input(Schema.toStandardSchemaV1(GetByDomainInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("RulesRouter.getByDomain")(function* ({ input }) {
          return yield* RulesService.use((s) =>
            s.getRulesByDomain({ domain: input.domain }),
          );
        }),
      ),
    ),

  updateMultiple: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateMultipleInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("RulesRouter.updateMultiple")(function* ({ input }) {
          return yield* RulesService.use((s) =>
            s.updateMultipleRules({
              domain: input.domain,
              data: [...input.data],
            }),
          );
        }),
      ),
    ),
});
