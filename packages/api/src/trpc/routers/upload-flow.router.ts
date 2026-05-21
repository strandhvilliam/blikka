import 'server-only'

import { Effect, Schema } from 'effect'
import {
  GetPublicMarathonSchema,
  PrepareUploadFlowSchema,
  ResolveByCameraParticipantByPhoneSchema,
  CheckParticipantExistsSchema,
  GetUploadStatusSchema,
  RefreshPresignedUploadsSchema,
  ReTriggerUploadFlowSchema,
} from '../../core/upload-flow/contracts'
import { trpcEffect } from '../utils'
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from '../root'
import { UploadFlowService } from '../../core/upload-flow/service'

export const uploadFlowRouter = createTRPCRouter({
  getPublicMarathon: publicProcedure
    .input(Schema.toStandardSchemaV1(GetPublicMarathonSchema))
    .query(
      trpcEffect(
        Effect.fn('UploadFlowRouter.getPublicMarathon')(function* ({ input }) {
          return yield* UploadFlowService.use((s) => s.getPublicMarathon(input))
        }),
      ),
    ),

  prepareUploadFlow: publicProcedure
    .input(Schema.toStandardSchemaV1(PrepareUploadFlowSchema))
    .mutation(
      trpcEffect(
        Effect.fn('UploadFlowRouter.prepareUploadFlow')(function* ({ input }) {
          return yield* UploadFlowService.use((s) => s.prepareUploadFlow(input))
        }),
      ),
    ),

  resolveByCameraParticipantByPhone: publicProcedure
    .input(Schema.toStandardSchemaV1(ResolveByCameraParticipantByPhoneSchema))
    .mutation(
      trpcEffect(
        Effect.fn('UploadFlowRouter.resolveByCameraParticipantByPhone')(function* ({ input }) {
          return yield* UploadFlowService.use((s) => s.resolveByCameraParticipantByPhone(input))
        }),
      ),
    ),

  checkParticipantExists: publicProcedure
    .input(Schema.toStandardSchemaV1(CheckParticipantExistsSchema))
    .mutation(
      trpcEffect(
        Effect.fn('UploadFlowRouter.checkParticipantExists')(function* ({ input }) {
          return yield* UploadFlowService.use((s) => s.checkParticipantExists(input))
        }),
      ),
    ),

  getUploadStatus: publicProcedure.input(Schema.toStandardSchemaV1(GetUploadStatusSchema)).query(
    trpcEffect(
      Effect.fn('UploadFlowRouter.getUploadStatus')(function* ({ input }) {
        return yield* UploadFlowService.use((s) => s.getUploadStatus(input))
      }),
    ),
  ),

  refreshPresignedUploads: publicProcedure
    .input(Schema.toStandardSchemaV1(RefreshPresignedUploadsSchema))
    .mutation(
      trpcEffect(
        Effect.fn('UploadFlowRouter.refreshPresignedUploads')(function* ({ input }) {
          return yield* UploadFlowService.use((s) => s.refreshPresignedUploads(input))
        }),
      ),
    ),

  reTriggerUploadFlow: domainProcedure
    .input(Schema.toStandardSchemaV1(ReTriggerUploadFlowSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('UploadFlowRouter.reTriggerUploadFlow')(function* ({ input }) {
          return yield* UploadFlowService.use((s) => s.reTriggerUploadFlow(input))
        }),
      ),
    ),
})
