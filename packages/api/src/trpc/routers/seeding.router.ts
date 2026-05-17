import "server-only";

import { Effect, Schema } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../root";
import { trpcEffect } from "../utils";
import {
  GetSeedScenarioStatusInputSchema,
  SeedFinishedScenarioInputSchema,
} from "../../core/seeding/contracts";
import { SeedingService } from "../../core/seeding/service";

function isAdminForDomain({
  domain,
  permissions,
}: {
  domain: string;
  permissions: ReadonlyArray<{ domain: string; role: string }>;
}) {
  return permissions.some(
    (permission) => permission.domain === domain && permission.role === "admin",
  );
}

export const seedingRouter = createTRPCRouter({
  getStatus: domainProcedure
    .input(Schema.toStandardSchemaV1(GetSeedScenarioStatusInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("SeedingRouter.getStatus")(function* ({ input, ctx }) {
          return yield* SeedingService.use((s) =>
            s.getStatus({
              domain: input.domain,
              isAdminForDomain: isAdminForDomain({
                domain: input.domain,
                permissions: ctx.permissions,
              }),
            }),
          );
        }),
      ),
    ),
  seedFinishedScenario: domainProcedure
    .input(Schema.toStandardSchemaV1(SeedFinishedScenarioInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("SeedingRouter.seedFinishedScenario")(function* ({
          input,
          ctx,
        }) {
          return yield* SeedingService.use((s) =>
            s.seedFinishedScenarioForDomain({
              domain: input.domain,
              isAdminForDomain: isAdminForDomain({
                domain: input.domain,
                permissions: ctx.permissions,
              }),
            }),
          );
        }),
      ),
    ),
});
