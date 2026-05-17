import 'server-only'

import { Effect, Schema } from 'effect'

import { createTRPCRouter, domainProcedure, requireMatchingInputDomainMiddleware } from '../root'
import { trpcEffect } from '../utils'
import {
  BeginAdminReplaceUploadInputSchema,
  CompleteAdminReplaceUploadInputSchema,
  RegenerateSubmissionAssetsInputSchema,
} from '../../core/submissions/contracts'
import { SubmissionsService } from '../../core/submissions/service'

export const submissionsRouter = createTRPCRouter({
  beginAdminReplaceUpload: domainProcedure
    .input(Schema.toStandardSchemaV1(BeginAdminReplaceUploadInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('SubmissionsRouter.beginAdminReplaceUpload')(function* ({ input, ctx }) {
          const isAdminForDomain = ctx.permissions.some(
            (permission) => permission.domain === input.domain && permission.role === 'admin',
          )

          return yield* SubmissionsService.use((service) =>
            service.beginAdminReplaceUpload({
              domain: input.domain,
              submissionId: input.submissionId,
              contentType: input.contentType,
              isAdminForDomain,
            }),
          )
        }),
      ),
    ),
  completeAdminReplaceUpload: domainProcedure
    .input(Schema.toStandardSchemaV1(CompleteAdminReplaceUploadInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('SubmissionsRouter.completeAdminReplaceUpload')(function* ({ input, ctx }) {
          const isAdminForDomain = ctx.permissions.some(
            (permission) => permission.domain === input.domain && permission.role === 'admin',
          )

          return yield* SubmissionsService.use((service) =>
            service.completeAdminReplaceUpload({
              domain: input.domain,
              submissionId: input.submissionId,
              newKey: input.newKey,
              previousKey: input.previousKey,
              isAdminForDomain,
            }),
          )
        }),
      ),
    ),
  regenerateSubmissionAssets: domainProcedure
    .input(Schema.toStandardSchemaV1(RegenerateSubmissionAssetsInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('SubmissionsRouter.regenerateSubmissionAssets')(function* ({ input, ctx }) {
          const isAdminForDomain = ctx.permissions.some(
            (permission) => permission.domain === input.domain && permission.role === 'admin',
          )

          return yield* SubmissionsService.use((service) =>
            service.regenerateSubmissionAssets({
              domain: input.domain,
              submissionId: input.submissionId,
              regenerateExif: input.regenerateExif,
              regenerateThumbnail: input.regenerateThumbnail,
              rerunValidations: input.rerunValidations,
              isAdminForDomain,
            }),
          )
        }),
      ),
    ),
})
