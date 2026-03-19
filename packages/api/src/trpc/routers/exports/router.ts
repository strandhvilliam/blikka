import "server-only";

import { Effect } from "effect";
import {
  authProcedure,
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import {
  GetParticipantsExportDataInputSchema,
  GetSubmissionsExportDataInputSchema,
  GetExifExportDataInputSchema,
  GetValidationResultsExportDataInputSchema,
} from "./schemas";
import { ExportsApiService } from "./service";

export const exportsRouter = createTRPCRouter({
  getParticipantsExportData: domainProcedure
    .input(GetParticipantsExportDataInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getParticipantsExportData")(function* ({
          input,
        }) {
          return yield* ExportsApiService.use((s) =>
            s.getParticipantsExportData({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  getSubmissionsExportData: domainProcedure
    .input(GetSubmissionsExportDataInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getSubmissionsExportData")(function* ({
          input,
        }) {
          return yield* ExportsApiService.use((s) =>
            s.getSubmissionsExportData({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  getParticipantsExportDataByCameraActiveTopic: domainProcedure
    .input(GetParticipantsExportDataInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getParticipantsExportDataByCameraActiveTopic")(function* ({
          input,
        }) {
          return yield* ExportsApiService.use((s) =>
            s.getParticipantsExportDataByCameraActiveTopic({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  getSubmissionsExportDataByCameraActiveTopic: domainProcedure
    .input(GetSubmissionsExportDataInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getSubmissionsExportDataByCameraActiveTopic")(function* ({
          input,
        }) {
          return yield* ExportsApiService.use((s) =>
            s.getSubmissionsExportDataByCameraActiveTopic({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  getExifExportData: domainProcedure
    .input(GetExifExportDataInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getExifExportData")(function* ({ input }) {
          return yield* ExportsApiService.use((s) =>
            s.getExifExportData({
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  getValidationResultsExportData: domainProcedure
    .input(GetValidationResultsExportDataInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getValidationResultsExportData")(function* ({
          input,
        }) {
          return yield* ExportsApiService.use((s) =>
            s.getValidationResultsExportData({
              domain: input.domain,
              onlyFailed: input.onlyFailed ?? undefined,
            }),
          );
        }),
      ),
    ),

  getValidationResultsExportDataByCameraActiveTopic: domainProcedure
    .input(GetValidationResultsExportDataInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ExportsRouter.getValidationResultsExportDataByCameraActiveTopic")(function* ({
          input,
        }) {
          return yield* ExportsApiService.use((s) =>
            s.getValidationResultsExportDataByCameraActiveTopic({
              domain: input.domain,
              onlyFailed: input.onlyFailed ?? undefined,
            }),
          );
        }),
      ),
    ),
});
