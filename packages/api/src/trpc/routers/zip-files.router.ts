
import { Effect, Schema } from 'effect'
import { createTRPCRouter, domainProcedure, requireMatchingInputDomainMiddleware } from '../root'
import { trpcEffect } from '../utils'
import {
  InitializeZipDownloadsInputSchema,
  GetZipSubmissionStatusInputSchema,
  ZipDownloadsByProcessIdInputSchema,
  GetActiveProcessInputSchema,
  CancelDownloadProcessInputSchema,
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

  getZipDownloadUrls: domainProcedure
    .input(Schema.toStandardSchemaV1(ZipDownloadsByProcessIdInputSchema))
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
