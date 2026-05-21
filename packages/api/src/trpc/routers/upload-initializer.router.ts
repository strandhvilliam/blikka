
import { Effect, Schema } from 'effect'
import {
  InitializeUploadFlowSchema,
  InitializeByCameraUploadSchema,
  InitializeStaffByCameraUploadSchema,
} from '../../core/upload-initializer/contracts'
import { trpcEffect } from '../utils'
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from '../root'
import { UploadInitializerService } from '../../core/upload-initializer/service'

export const uploadInitializerRouter = createTRPCRouter({
  initializeUploadFlow: publicProcedure
    .input(Schema.toStandardSchemaV1(InitializeUploadFlowSchema))
    .mutation(
      trpcEffect(
        Effect.fn('UploadInitializerRouter.initializeUploadFlow')(function* ({ input }) {
          return yield* UploadInitializerService.use((s) => s.initializeUploadFlow(input))
        }),
      ),
    ),

  initializeByCameraUpload: publicProcedure
    .input(Schema.toStandardSchemaV1(InitializeByCameraUploadSchema))
    .mutation(
      trpcEffect(
        Effect.fn('UploadInitializerRouter.initializeByCameraUpload')(function* ({ input }) {
          return yield* UploadInitializerService.use((s) =>
            s.initializeByCameraUpload({ ...input, variant: 'device' }),
          )
        }),
      ),
    ),

  initializeStaffByCameraUpload: domainProcedure
    .input(Schema.toStandardSchemaV1(InitializeStaffByCameraUploadSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('UploadInitializerRouter.initializeStaffByCameraUpload')(function* ({ input }) {
          return yield* UploadInitializerService.use((s) =>
            s.initializeByCameraUpload({ ...input, variant: 'staff' }),
          )
        }),
      ),
    ),
})
