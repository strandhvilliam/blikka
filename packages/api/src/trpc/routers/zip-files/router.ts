import "server-only"

import { Effect } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import {
  InitializeZipDownloadsInputSchema,
  GetZipSubmissionStatusInputSchema,
  GetZipDownloadProgressInputSchema,
  GetActiveProcessInputSchema,
  CancelDownloadProcessInputSchema,
} from "./schemas"
import { ZipFilesApiService } from "./service"

export const zipFilesRouter = createTRPCRouter({
  initializeZipDownloads: domainProcedure.input(InitializeZipDownloadsInputSchema).mutation(
    trpcEffect(
      Effect.fn("ZipFilesRouter.initializeZipDownloads")(function* ({ input }) {
        return yield* ZipFilesApiService.initializeZipDownloads({
          domain: input.domain,
        })
      })
    )
  ),

  getZipSubmissionStatus: domainProcedure.input(GetZipSubmissionStatusInputSchema).query(
    trpcEffect(
      Effect.fn("ZipFilesRouter.getZipSubmissionStatus")(function* ({ input }) {
        return yield* ZipFilesApiService.getZipSubmissionStats({
          domain: input.domain,
        })
      })
    )
  ),

  getZipDownloadProgress: domainProcedure.input(GetZipDownloadProgressInputSchema).query(
    trpcEffect(
      Effect.fn("ZipFilesRouter.getZipDownloadProgress")(function* ({ input }) {
        const result = yield* ZipFilesApiService.getZipDownloadProgress({
          processId: input.processId,
        })

        // if (result === null) {
        //   return yield* Effect.fail(
        //     new ZipFilesApiError({ message: "Download process not found" }),
        //   );
        // }
        return result
      })
    )
  ),

  getZipDownloadUrls: domainProcedure.input(GetZipDownloadProgressInputSchema).query(
    trpcEffect(
      Effect.fn("ZipFilesRouter.getZipDownloadUrls")(function* ({ input }) {
        const result = yield* ZipFilesApiService.getZipDownloadUrls({
          processId: input.processId,
        })
        return result
      })
    )
  ),

  getActiveProcess: domainProcedure.input(GetActiveProcessInputSchema).query(
    trpcEffect(
      Effect.fn("ZipFilesRouter.getActiveProcess")(function* ({ input }) {
        return yield* ZipFilesApiService.getActiveProcess({
          domain: input.domain,
        })
      })
    )
  ),

  cancelDownloadProcess: domainProcedure.input(CancelDownloadProcessInputSchema).mutation(
    trpcEffect(
      Effect.fn("ZipFilesRouter.cancelDownloadProcess")(function* ({ input }) {
        return yield* ZipFilesApiService.cancelDownloadProcess({
          domain: input.domain,
          processId: input.processId,
        })
      })
    )
  ),
})
