import "server-only"

import { Effect } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import {
  GetParticipantsExportDataInputSchema,
  GetSubmissionsExportDataInputSchema,
  GetExifExportDataInputSchema,
  GetValidationResultsExportDataInputSchema,
} from "./schemas"
import { ExportsApiService } from "./service"

export const exportsRouter = createTRPCRouter({
  getParticipantsExportData: authProcedure.input(GetParticipantsExportDataInputSchema).query(
    trpcEffect(
      Effect.fn("ExportsRouter.getParticipantsExportData")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
        return yield* ExportsApiService.getParticipantsExportData({
          domain: input.domain,
        })
      })
    )
  ),

  getSubmissionsExportData: authProcedure.input(GetSubmissionsExportDataInputSchema).query(
    trpcEffect(
      Effect.fn("ExportsRouter.getSubmissionsExportData")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
        return yield* ExportsApiService.getSubmissionsExportData({
          domain: input.domain,
        })
      })
    )
  ),

  getExifExportData: authProcedure.input(GetExifExportDataInputSchema).query(
    trpcEffect(
      Effect.fn("ExportsRouter.getExifExportData")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
        return yield* ExportsApiService.getExifExportData({
          domain: input.domain,
        })
      })
    )
  ),

  getValidationResultsExportData: authProcedure
    .input(GetValidationResultsExportDataInputSchema)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getValidationResultsExportData")(function* ({ input, ctx }) {
          yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
          return yield* ExportsApiService.getValidationResultsExportData({
            domain: input.domain,
            onlyFailed: input.onlyFailed ?? undefined,
          })
        })
      )
    ),
})
