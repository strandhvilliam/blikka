import "server-only";

import { Effect } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import {
  GetSponsorsByMarathonInputSchema,
  CreateSponsorInputSchema,
  GenerateSponsorUploadUrlInputSchema,
} from "./schemas";
import { SponsorsApiService } from "./service";

export const sponsorsRouter = createTRPCRouter({
  getByMarathon: domainProcedure
    .input(GetSponsorsByMarathonInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("SponsorsRouter.getByMarathon")(function* ({ input }) {
          return yield* SponsorsApiService.use((s) =>
            s.getSponsorsByMarathon({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  create: domainProcedure
    .input(CreateSponsorInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("SponsorsRouter.create")(function* ({ input }) {
          return yield* SponsorsApiService.use((s) =>
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
    .input(GenerateSponsorUploadUrlInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("SponsorsRouter.generateUploadUrl")(function* ({ input }) {
          return yield* SponsorsApiService.use((s) =>
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
