import { Effect, Layer, ServiceMap } from "effect"
import { Database } from "@blikka/db"
import { ExportsApiError } from "./schemas"

export class ExportsApiService extends ServiceMap.Service<ExportsApiService>()(
  "@blikka/api/ExportsApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database

      const getParticipantsExportData = Effect.fn("ExportsApiService.getParticipantsExportData")(
        function* ({ domain }: { domain: string }) {
          try {
            return yield* db.exportsQueries.getParticipantsForExport({ domain })
          } catch (error) {
            return yield* Effect.fail(
              new ExportsApiError({
                message: "Failed to fetch participants export data",
                cause: error,
              })
            )
          }
        }
      )

      const getSubmissionsExportData = Effect.fn("ExportsApiService.getSubmissionsExportData")(
        function* ({ domain }: { domain: string }) {
          try {
            return yield* db.exportsQueries.getSubmissionsForExport({ domain })
          } catch (error) {
            return yield* Effect.fail(
              new ExportsApiError({
                message: "Failed to fetch submissions export data",
                cause: error,
              })
            )
          }
        }
      )

      const getExifExportData = Effect.fn("ExportsApiService.getExifExportData")(function* ({
        domain,
      }: {
        domain: string
      }) {
        try {
          return yield* db.exportsQueries.getExifDataForExport({ domain })
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to fetch EXIF export data",
              cause: error,
            })
          )
        }
      })

      const getValidationResultsExportData = Effect.fn(
        "ExportsApiService.getValidationResultsExportData"
      )(function* ({ domain, onlyFailed }: { domain: string; onlyFailed?: boolean }) {
        try {
          return yield* db.exportsQueries.getValidationResultsForExport({ domain, onlyFailed })
        } catch (error) {
          return yield* Effect.fail(
            new ExportsApiError({
              message: "Failed to fetch validation results export data",
              cause: error,
            })
          )
        }
      })

      return {
        getParticipantsExportData,
        getSubmissionsExportData,
        getExifExportData,
        getValidationResultsExportData,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Database.layer)
  )
}
