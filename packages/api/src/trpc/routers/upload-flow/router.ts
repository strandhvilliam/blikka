import "server-only";

import { Effect } from "effect";
import {
  GetPublicMarathonSchema,
  InitializeUploadFlowSchema,
  PrepareUploadFlowSchema,
  InitializeByCameraUploadSchema,
  ResolveByCameraParticipantByPhoneSchema,
  CheckParticipantExistsSchema,
  GetUploadStatusSchema,
  ReTriggerUploadFlowSchema,
} from "./schemas";
import { trpcEffect } from "../../utils";
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { UploadFlowApiService } from "./service";

export const uploadFlowRouter = createTRPCRouter({
  getPublicMarathon: publicProcedure.input(GetPublicMarathonSchema).query(
    trpcEffect(
      Effect.fn("UploadFlowRouter.getPublicMarathon")(function* ({ input }) {
        // TODO: add cache. the cache should be invalidated when the marathon is updated.
        return yield* UploadFlowApiService.use((s) =>
          s.getPublicMarathon(input),
        );
      }),
    ),
  ),
  initializeUploadFlow: publicProcedure
    .input(InitializeUploadFlowSchema)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.initializeUploadFlow")(function* ({
          input,
        }) {
          return yield* UploadFlowApiService.use((s) =>
            s.initializeUploadFlow(input),
          );
        }),
      ),
    ),
  prepareUploadFlow: publicProcedure.input(PrepareUploadFlowSchema).mutation(
    trpcEffect(
      Effect.fn("UploadFlowRouter.prepareUploadFlow")(function* ({ input }) {
        return yield* UploadFlowApiService.use((s) =>
          s.prepareUploadFlow(input),
        );
      }),
    ),
  ),

  initializeByCameraUpload: publicProcedure
    .input(InitializeByCameraUploadSchema)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.initializeByCameraUpload")(function* ({
          input,
        }) {
          return yield* UploadFlowApiService.use((s) =>
            s.initializeByCameraUpload(input),
          );
        }),
      ),
    ),

  resolveByCameraParticipantByPhone: publicProcedure
    .input(ResolveByCameraParticipantByPhoneSchema)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.resolveByCameraParticipantByPhone")(
          function* ({ input }) {
            return yield* UploadFlowApiService.use((s) =>
              s.resolveByCameraParticipantByPhone(input),
            );
          },
        ),
      ),
    ),

  checkParticipantExists: publicProcedure
    .input(CheckParticipantExistsSchema)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.checkParticipantExists")(function* ({
          input,
        }) {
          return yield* UploadFlowApiService.use((s) =>
            s.checkParticipantExists(input),
          );
        }),
      ),
    ),

  getUploadStatus: publicProcedure.input(GetUploadStatusSchema).query(
    trpcEffect(
      Effect.fn("UploadFlowRouter.getUploadStatus")(function* ({ input }) {
        return yield* UploadFlowApiService.use((s) => s.getUploadStatus(input));
      }),
    ),
  ),

  reTriggerUploadFlow: domainProcedure
    .input(ReTriggerUploadFlowSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.reTriggerUploadFlow")(function* ({
          input,
        }) {
          return yield* UploadFlowApiService.use((s) =>
            s.reTriggerUploadFlow(input),
          );
        }),
      ),
    ),
});
