import "server-only";

import { Effect, Schema } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../root";
import { trpcEffect } from "../utils";
import {
  GetSponsorsByMarathonInputSchema,
  CreateSponsorInputSchema,
  GenerateSponsorUploadUrlInputSchema,
} from "../../core/sponsors/contracts";
import { SponsorsService } from "../../core/sponsors/service";

export const sponsorsRouter = createTRPCRouter({
  getByMarathon: domainProcedure
    .input(Schema.toStandardSchemaV1(GetSponsorsByMarathonInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("SponsorsRouter.getByMarathon")(function* ({ input }) {
          return yield* SponsorsService.use((s) =>
            s.getSponsorsByMarathon({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  create: domainProcedure
    .input(Schema.toStandardSchemaV1(CreateSponsorInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("SponsorsRouter.create")(function* ({ input }) {
          return yield* SponsorsService.use((s) =>
            s.createSponsor({
              domain: input.domain,
              type: input.type,
              position: input.position,
              key: input.key,
            }),
          );
        }),
      ),
    ),

  generateUploadUrl: domainProcedure
    .input(Schema.toStandardSchemaV1(GenerateSponsorUploadUrlInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("SponsorsRouter.generateUploadUrl")(function* ({ input }) {
          return yield* SponsorsService.use((s) =>
            s.generateUploadUrl({
              domain: input.domain,
              type: input.type,
              position: input.position,
            }),
          );
        }),
      ),
    ),
});
