import "server-only"

import { Effect } from "effect"
import { authProcedure, createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import {
  GetParticipantsExportDataInputSchema,
  GetSubmissionsExportDataInputSchema,
  GetExifExportDataInputSchema,
  GetValidationResultsExportDataInputSchema,
} from "./schemas"
import { ExportsApiService } from "./service"

export const exportsRouter = createTRPCRouter({
  getParticipantsExportData: domainProcedure.input(GetParticipantsExportDataInputSchema).query(
    trpcEffect(
      Effect.fn("ExportsRouter.getParticipantsExportData")(function* ({ input }) {
        return yield* ExportsApiService.use((s) =>
          s.getParticipantsExportData({
            domain: input.domain,
          })
        )
      })
    )
  ),

  getSubmissionsExportData: domainProcedure.input(GetSubmissionsExportDataInputSchema).query(
    trpcEffect(
      Effect.fn("ExportsRouter.getSubmissionsExportData")(function* ({ input }) {
        return yield* ExportsApiService.use((s) =>
          s.getSubmissionsExportData({
            domain: input.domain,
          })
        )
      })
    )
  ),

  getExifExportData: domainProcedure.input(GetExifExportDataInputSchema).query(
    trpcEffect(
      Effect.fn("ExportsRouter.getExifExportData")(function* ({ input }) {
        return yield* ExportsApiService.use((s) =>
          s.getExifExportData({
            domain: input.domain,
          })
        )
      })
    )
  ),

  getValidationResultsExportData: domainProcedure
    .input(GetValidationResultsExportDataInputSchema)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getValidationResultsExportData")(function* ({ input }) {
          return yield* ExportsApiService.use((s) =>
            s.getValidationResultsExportData({
              domain: input.domain,
              onlyFailed: input.onlyFailed ?? undefined,
            })
          )
        })
      )
    ),
})
