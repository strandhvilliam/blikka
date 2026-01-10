import "server-only"

import { Effect } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import { InitializeZipDownloadsInputSchema } from "./schemas"
import { ZipFilesApiService } from "./service"

export const zipFilesRouter = createTRPCRouter({
  initializeZipDownloads: domainProcedure
    .input(InitializeZipDownloadsInputSchema)
    .mutation(
      trpcEffect(
        Effect.fn("ZipFilesRouter.initializeZipDownloads")(function* ({ input }) {
          return yield* ZipFilesApiService.initializeZipDownloads({ domain: input.domain })
        })
      )
    ),
})
