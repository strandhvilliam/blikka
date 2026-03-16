import "server-only";

import { Effect } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import { GetByDomainInputSchema, UpdateMultipleInputSchema } from "./schemas";
import { RulesApiService } from "./service";

export const rulesRouter = createTRPCRouter({
  getByDomain: domainProcedure
    .input(GetByDomainInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("RulesRouter.getByDomain")(function* ({ input }) {
          return yield* RulesApiService.use((s) =>
            s.getRulesByDomain({ domain: input.domain }),
          );
        }),
      ),
    ),

  updateMultiple: domainProcedure
    .input(UpdateMultipleInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("RulesRouter.updateMultiple")(function* ({ input }) {
          return yield* RulesApiService.use((s) =>
            s.updateMultipleRules({
              domain: input.domain,
              data: [...input.data],
            }),
          );
        }),
      ),
    ),
});
