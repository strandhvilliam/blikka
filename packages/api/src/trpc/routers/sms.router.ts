
import { Effect, Schema } from 'effect'
import { createTRPCRouter, authProcedure } from '../root'
import { trpcEffect } from '../utils'
import { SendTestSMSInputSchema } from '../../core/sms/contracts'
import { SMSService } from '@blikka/aws'

export const smsRouter = createTRPCRouter({
  sendTest: authProcedure.input(Schema.toStandardSchemaV1(SendTestSMSInputSchema)).mutation(
    trpcEffect(
      Effect.fn('SMSRouter.sendTest')(function* ({ input }) {
        const smsService = yield* SMSService

        const result = yield* smsService.sendWithOptOutCheck({
          phoneNumber: input.phoneNumber,
          message: input.message,
        })

        return {
          success: true,
          messageId: result.messageId,
          phoneNumber: result.phoneNumber,
        }
      }),
    ),
  ),
})
