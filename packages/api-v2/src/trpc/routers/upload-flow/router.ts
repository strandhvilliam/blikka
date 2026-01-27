import "server-only";

import { Effect } from "effect";
import {
  GetPublicMarathonSchema,
  InitializeUploadFlowSchema,
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
