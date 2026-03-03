import "server-only";

import { Effect } from "effect";
import { createTRPCRouter, authProcedure } from "../../root";
import { trpcEffect } from "../../utils";
import { SendTestSMSInputSchema } from "./schemas";
import { SMSService } from "@blikka/sms";

export const smsRouter = createTRPCRouter({
  sendTest: authProcedure.input(SendTestSMSInputSchema).mutation(
    trpcEffect(
      Effect.fn("SMSRouter.sendTest")(function*({ input }) {
        const smsService = yield* SMSService;

        const result = yield* smsService.sendWithOptOutCheck({
          phoneNumber: input.phoneNumber,
          message: input.message,
        });

        return {
          success: true,
          messageId: result.messageId,
          phoneNumber: result.phoneNumber,
        };
      }),
    ),
  ),
});
