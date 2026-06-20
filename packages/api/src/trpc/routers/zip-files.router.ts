import { Effect, Schema } from 'effect'
import { createTRPCRouter, domainProcedure, requireMatchingInputDomainMiddleware } from '../root'
import { trpcEffect } from '../utils'
import {
  InitializeZipDownloadsInputSchema,
  GetZipSubmissionStatusInputSchema,
  GetExportFilesInputSchema,
  CancelDownloadProcessInputSchema,
  RetryExportChunkInputSchema,
  GenerateParticipantZipInputSchema,
  GetParticipantZipDownloadUrlInputSchema,
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

  getExportFiles: domainProcedure
    .input(Schema.toStandardSchemaV1(GetExportFilesInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ZipFilesRouter.getExportFiles')(function* ({ input }) {
          return yield* ZipFilesService.use((s) => s.getExportFiles({ domain: input.domain }))
        }),
      ),
    ),

  getExportPreview: domainProcedure
    .input(Schema.toStandardSchemaV1(GetZipSubmissionStatusInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ZipFilesRouter.getExportPreview')(function* ({ input }) {
          return yield* ZipFilesService.use((s) => s.getExportPreview({ domain: input.domain }))
        }),
      ),
    ),

  retryExportChunk: domainProcedure
    .input(Schema.toStandardSchemaV1(RetryExportChunkInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ZipFilesRouter.retryExportChunk')(function* ({ input }) {
          return yield* ZipFilesService.use((s) =>
            s.retryExportChunk({
              domain: input.domain,
              exportJobId: input.exportJobId,
              jobId: input.jobId,
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
              exportJobId: input.exportJobId,
            }),
          )
        }),
      ),
    ),

  generateParticipantZip: domainProcedure
    .input(Schema.toStandardSchemaV1(GenerateParticipantZipInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ZipFilesRouter.generateParticipantZip')(function* ({ input }) {
          return yield* ZipFilesService.use((s) =>
            s.generateParticipantZip({
              domain: input.domain,
              reference: input.reference,
            }),
          )
        }),
      ),
    ),

  getParticipantZipDownloadUrl: domainProcedure
    .input(Schema.toStandardSchemaV1(GetParticipantZipDownloadUrlInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ZipFilesRouter.getParticipantZipDownloadUrl')(function* ({ input }) {
          return yield* ZipFilesService.use((s) =>
            s.getParticipantZipDownloadUrl({
              domain: input.domain,
              reference: input.reference,
            }),
          )
        }),
      ),
    ),
})
