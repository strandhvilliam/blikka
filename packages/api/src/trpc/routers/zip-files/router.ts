import "server-only";

import { Effect } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import {
  InitializeZipDownloadsInputSchema,
  GetZipSubmissionStatusInputSchema,
  GetZipDownloadProgressInputSchema,
  GetActiveProcessInputSchema,
  CancelDownloadProcessInputSchema,
} from "./schemas";
import { ZipFilesApiService } from "./service";

export const zipFilesRouter = createTRPCRouter({
  initializeZipDownloads: domainProcedure
    .input(InitializeZipDownloadsInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("ZipFilesRouter.initializeZipDownloads")(function* ({
          input,
        }) {
          return yield* ZipFilesApiService.use((s) =>
            s.initializeZipDownloads({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  getZipSubmissionStatus: domainProcedure
    .input(GetZipSubmissionStatusInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ZipFilesRouter.getZipSubmissionStatus")(function* ({
          input,
        }) {
          return yield* ZipFilesApiService.use((s) =>
            s.getZipSubmissionStats({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  getZipDownloadProgress: domainProcedure
    .input(GetZipDownloadProgressInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ZipFilesRouter.getZipDownloadProgress")(function* ({
          input,
        }) {
          const result = yield* ZipFilesApiService.use((s) =>
            s.getZipDownloadProgress({
              processId: input.processId,
            }),
          );

          // if (result === null) {
          //   return yield* Effect.fail(
          //     new ZipFilesApiError({ message: "Download process not found" }),
          //   );
          // }
          return result;
        }),
      ),
    ),

  getZipDownloadUrls: domainProcedure
    .input(GetZipDownloadProgressInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ZipFilesRouter.getZipDownloadUrls")(function* ({ input }) {
          const result = yield* ZipFilesApiService.use((s) =>
            s.getZipDownloadUrls({
              processId: input.processId,
            }),
          );
          return result;
        }),
      ),
    ),

  getActiveProcess: domainProcedure
    .input(GetActiveProcessInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ZipFilesRouter.getActiveProcess")(function* ({ input }) {
          return yield* ZipFilesApiService.use((s) =>
            s.getActiveProcess({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  cancelDownloadProcess: domainProcedure
    .input(CancelDownloadProcessInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("ZipFilesRouter.cancelDownloadProcess")(function* ({
          input,
        }) {
          return yield* ZipFilesApiService.use((s) =>
            s.cancelDownloadProcess({
              domain: input.domain,
              processId: input.processId,
            }),
          );
        }),
      ),
    ),
});
