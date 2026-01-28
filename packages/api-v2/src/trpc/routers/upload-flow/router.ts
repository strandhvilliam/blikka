import "server-only";

import { Effect } from "effect";
import {
  GetPublicMarathonSchema,
  InitializeUploadFlowSchema,
  InitializeByCameraUploadSchema,
  FinalizeByCameraUploadSchema,
  CheckParticipantExistsSchema,
  GetUploadStatusSchema,
} from "./schemas";
import { trpcEffect } from "../../utils";
import { createTRPCRouter, publicProcedure } from "../../root";
import { UploadFlowApiService } from "./service";

export const uploadFlowRouter = createTRPCRouter({
  getPublicMarathon: publicProcedure.input(GetPublicMarathonSchema).query(
    trpcEffect(
      Effect.fn("UploadFlowRouter.getPublicMarathon")(function*({ input }) {
        return yield* UploadFlowApiService.getPublicMarathon(input);
      }),
    ),
  ),
  initializeUploadFlow: publicProcedure
    .input(InitializeUploadFlowSchema)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.initializeUploadFlow")(function*({
          input,
        }) {
          return yield* UploadFlowApiService.initializeUploadFlow(input);
        }),
      ),
    ),

  // By-camera mode endpoints
  initializeByCameraUpload: publicProcedure
    .input(InitializeByCameraUploadSchema)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.initializeByCameraUpload")(function*({
          input,
        }) {
          return yield* UploadFlowApiService.initializeByCameraUpload(input);
        }),
      ),
    ),

  finalizeByCameraUpload: publicProcedure
    .input(FinalizeByCameraUploadSchema)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.finalizeByCameraUpload")(function*({
          input,
        }) {
          return yield* UploadFlowApiService.finalizeByCameraUpload(input);
        }),
      ),
    ),

  checkParticipantExists: publicProcedure
    .input(CheckParticipantExistsSchema)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.checkParticipantExists")(function*({
          input,
        }) {
          return yield* UploadFlowApiService.checkParticipantExists(input);
        }),
      ),
    ),

  getUploadStatus: publicProcedure.input(GetUploadStatusSchema).query(
    trpcEffect(
      Effect.fn("UploadFlowRouter.getUploadStatus")(function*({ input }) {
        return yield* UploadFlowApiService.getUploadStatus(input);
      }),
    ),
  ),
});
