import "server-only";

import { Effect } from "effect";
import { GenerateContactSheetSchema } from "./schemas";
import { trpcEffect } from "../../utils";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { ContactSheetsApiService } from "./service";

export const contactSheetsRouter = createTRPCRouter({
  generateContactSheet: domainProcedure
    .input(GenerateContactSheetSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("ContactSheetsRouter.generateContactSheet")(function* ({
          input,
        }) {
          return yield* ContactSheetsApiService.use((s) =>
            s.generateContactSheet({
              domain: input.domain,
              reference: input.reference,
            }),
          );
        }),
      ),
    ),
});
