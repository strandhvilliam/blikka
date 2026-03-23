import "server-only";

import { Effect } from "effect";

import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import {
  BeginAdminReplaceUploadInputSchema,
  CompleteAdminReplaceUploadInputSchema,
  RegenerateSubmissionAssetsInputSchema,
} from "./schemas";
import { SubmissionsApiService } from "./service";

export const submissionsRouter = createTRPCRouter({
  beginAdminReplaceUpload: domainProcedure
    .input(BeginAdminReplaceUploadInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("SubmissionsRouter.beginAdminReplaceUpload")(function* ({
          input,
          ctx,
        }) {
          const isAdminForDomain = ctx.permissions.some(
            (permission) =>
              permission.domain === input.domain && permission.role === "admin",
          );

          return yield* SubmissionsApiService.use((service) =>
            service.beginAdminReplaceUpload({
              domain: input.domain,
              submissionId: input.submissionId,
              contentType: input.contentType,
              isAdminForDomain,
            }),
          );
        }),
      ),
    ),
  completeAdminReplaceUpload: domainProcedure
    .input(CompleteAdminReplaceUploadInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("SubmissionsRouter.completeAdminReplaceUpload")(function* ({
          input,
          ctx,
        }) {
          const isAdminForDomain = ctx.permissions.some(
            (permission) =>
              permission.domain === input.domain && permission.role === "admin",
          );

          return yield* SubmissionsApiService.use((service) =>
            service.completeAdminReplaceUpload({
              domain: input.domain,
              submissionId: input.submissionId,
              newKey: input.newKey,
              previousKey: input.previousKey,
              isAdminForDomain,
            }),
          );
        }),
      ),
    ),
  regenerateSubmissionAssets: domainProcedure
    .input(RegenerateSubmissionAssetsInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("SubmissionsRouter.regenerateSubmissionAssets")(function* ({
          input,
          ctx,
        }) {
          const isAdminForDomain = ctx.permissions.some(
            (permission) =>
              permission.domain === input.domain && permission.role === "admin",
          );

          return yield* SubmissionsApiService.use((service) =>
            service.regenerateSubmissionAssets({
              domain: input.domain,
              submissionId: input.submissionId,
              regenerateExif: input.regenerateExif,
              regenerateThumbnail: input.regenerateThumbnail,
              rerunValidations: input.rerunValidations,
              isAdminForDomain,
            }),
          );
        }),
      ),
    ),
});
