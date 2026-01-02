import "server-only"

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import { createTRPCRouter } from "../root"
import { participantRouter } from "./participants/router"
import { marathonRouter } from "./marathons/router"
import { uploadFlowRouter } from "./upload-flow/router"
import { validationsRouter } from "./validations/router"
import { contactSheetsRouter } from "./contact-sheets/router"
import { topicsRouter } from "./topics/router"

export const appRouter = createTRPCRouter({
  participants: participantRouter,
  marathons: marathonRouter,
  uploadFlow: uploadFlowRouter,
  validations: validationsRouter,
  contactSheets: contactSheetsRouter,
  topics: topicsRouter,
})

export type AppRouter = typeof appRouter
