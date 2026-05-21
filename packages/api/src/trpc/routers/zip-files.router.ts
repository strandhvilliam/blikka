
import { Effect, Schema } from 'effect'
import { createTRPCRouter, domainProcedure, requireMatchingInputDomainMiddleware } from '../root'
import { trpcEffect } from '../utils'
import {
  InitializeZipDownloadsInputSchema,
  GetZipSubmissionStatusInputSchema,
  GetZipDownloadProgressInputSchema,
  GetActiveProcessInputSchema,
  CancelDownloadProcessInputSchema,
} from '../../core/zip-files/contracts'
import { ZipFilesService } from '../../core/zip-files/service'

export const zipFilesRouter = createTRPCRouter({
  initializeZipDownloads: domainProcedure
    .input(Schema.toStandardSchemaV1(InitializeZipDownloadsInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ZipFilesRouter.initializeZipDownloads')(function* ({ input }) {
          return yield* ZipFilesService.use((s) =>
            s.initializeZipDownloads({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  getZipSubmissionStatus: domainProcedure
    .input(Schema.toStandardSchemaV1(GetZipSubmissionStatusInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ZipFilesRouter.getZipSubmissionStatus')(function* ({ input }) {
          return yield* ZipFilesService.use((s) =>
            s.getZipSubmissionStats({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  getZipDownloadProgress: domainProcedure
    .input(Schema.toStandardSchemaV1(GetZipDownloadProgressInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ZipFilesRouter.getZipDownloadProgress')(function* ({ input }) {
          const result = yield* ZipFilesService.use((s) =>
            s.getZipDownloadProgress({
              processId: input.processId,
            }),
          )

          // if (result === null) {
          //   return yield* Effect.fail(
          //     new ZipFilesApiError({ message: "Download process not found" }),
          //   );
          // }
          return result
        }),
      ),
    ),

  getZipDownloadUrls: domainProcedure
    .input(Schema.toStandardSchemaV1(GetZipDownloadProgressInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ZipFilesRouter.getZipDownloadUrls')(function* ({ input }) {
          const result = yield* ZipFilesService.use((s) =>
            s.getZipDownloadUrls({
              processId: input.processId,
            }),
          )
          return result
        }),
      ),
    ),

  getActiveProcess: domainProcedure
    .input(Schema.toStandardSchemaV1(GetActiveProcessInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ZipFilesRouter.getActiveProcess')(function* ({ input }) {
          return yield* ZipFilesService.use((s) =>
            s.getActiveProcess({
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  cancelDownloadProcess: domainProcedure
    .input(Schema.toStandardSchemaV1(CancelDownloadProcessInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ZipFilesRouter.cancelDownloadProcess')(function* ({ input }) {
          return yield* ZipFilesService.use((s) =>
            s.cancelDownloadProcess({
              domain: input.domain,
              processId: input.processId,
            }),
          )
        }),
      ),
    ),
})
