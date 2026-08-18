
import { Effect, Schema } from 'effect'
import {
  GenerateContactSheetSchema,
  SendContactSheetConfirmationEmailSchema,
} from '../../core/contact-sheets/contracts'
import { trpcEffect } from '../utils'
import { createTRPCRouter, domainProcedure, requireMatchingInputDomainMiddleware } from '../root'
import { ContactSheetsService } from '../../core/contact-sheets/service'

export const contactSheetsRouter = createTRPCRouter({
  generateContactSheet: domainProcedure
    .input(Schema.toStandardSchemaV1(GenerateContactSheetSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ContactSheetsRouter.generateContactSheet')(function* ({ input }) {
          return yield* ContactSheetsService.use((s) =>
            s.generateContactSheet({
              domain: input.domain,
              reference: input.reference,
            }),
          )
        }),
      ),
    ),
  sendConfirmationEmail: domainProcedure
    .input(Schema.toStandardSchemaV1(SendContactSheetConfirmationEmailSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ContactSheetsRouter.sendConfirmationEmail')(function* ({ input }) {
          return yield* ContactSheetsService.use((s) =>
            s.sendConfirmationEmail({
              domain: input.domain,
              reference: input.reference,
            }),
          )
        }),
      ),
    ),
})
