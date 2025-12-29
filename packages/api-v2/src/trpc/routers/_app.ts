import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import { createTRPCRouter } from "../root"
import { participantRouter } from "./participants"
import { authTestRouter } from "./authtest"
import { marathonRouter } from "./marathons"
import { uploadFlowRouter } from "./upload-flow"
import { validationsRouter } from "./validations"
import { contactSheetsRouter } from "./contact-sheets"

export const appRouter = createTRPCRouter({
  participants: participantRouter,
  authtest: authTestRouter,
  marathons: marathonRouter,
  uploadFlow: uploadFlowRouter,
  validations: validationsRouter,
  contactSheets: contactSheetsRouter,
})

export type AppRouter = typeof appRouter
export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>
