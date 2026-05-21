
import { Effect, Schema } from 'effect'
import {
  authProcedure,
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from '../root'
import { trpcEffect } from '../utils'
import {
  GetParticipantsExportDataInputSchema,
  GetSubmissionsExportDataInputSchema,
  GetValidationResultsExportDataInputSchema,
} from '../../core/exports/contracts'
import { ExportsService } from '../../core/exports/service'

export const exportsRouter = createTRPCRouter({
  getParticipantsExportData: domainProcedure
    .input(Schema.toStandardSchemaV1(GetParticipantsExportDataInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ExportsRouter.getParticipantsExportData')(function* ({ input }) {
          return yield* ExportsService.use((s) =>
            s.getParticipantsExportData({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  getSubmissionsExportData: domainProcedure
    .input(Schema.toStandardSchemaV1(GetSubmissionsExportDataInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ExportsRouter.getSubmissionsExportData')(function* ({ input }) {
          return yield* ExportsService.use((s) =>
            s.getSubmissionsExportData({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  getParticipantsExportDataByCameraActiveTopic: domainProcedure
    .input(Schema.toStandardSchemaV1(GetParticipantsExportDataInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ExportsRouter.getParticipantsExportDataByCameraActiveTopic')(function* ({
          input,
        }) {
          return yield* ExportsService.use((s) =>
            s.getParticipantsExportDataByCameraActiveTopic({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  getParticipantsExportDataByCameraAllTopics: domainProcedure
    .input(Schema.toStandardSchemaV1(GetParticipantsExportDataInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ExportsRouter.getParticipantsExportDataByCameraAllTopics')(function* ({
          input,
        }) {
          return yield* ExportsService.use((s) =>
            s.getParticipantsExportDataByCameraAllTopics({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  getSubmissionsExportDataByCameraActiveTopic: domainProcedure
    .input(Schema.toStandardSchemaV1(GetSubmissionsExportDataInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ExportsRouter.getSubmissionsExportDataByCameraActiveTopic')(function* ({
          input,
        }) {
          return yield* ExportsService.use((s) =>
            s.getSubmissionsExportDataByCameraActiveTopic({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  getValidationResultsExportData: domainProcedure
    .input(Schema.toStandardSchemaV1(GetValidationResultsExportDataInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ExportsRouter.getValidationResultsExportData')(function* ({ input }) {
          return yield* ExportsService.use((s) =>
            s.getValidationResultsExportData({
              domain: input.domain,
              onlyFailed: input.onlyFailed ?? undefined,
            }),
          )
        }),
      ),
    ),

  getValidationResultsExportDataByCameraActiveTopic: domainProcedure
    .input(Schema.toStandardSchemaV1(GetValidationResultsExportDataInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ExportsRouter.getValidationResultsExportDataByCameraActiveTopic')(function* ({
          input,
        }) {
          return yield* ExportsService.use((s) =>
            s.getValidationResultsExportDataByCameraActiveTopic({
              domain: input.domain,
              onlyFailed: input.onlyFailed ?? undefined,
            }),
          )
        }),
      ),
    ),
})
