import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import { createTRPCRouter } from "../root"
import { participantRouter } from "./participants"
import { authTestRouter } from "./authtest"
import { marathonRouter } from "./marathons"

export const appRouter = createTRPCRouter({
  participants: participantRouter,
  authtest: authTestRouter,
  marathons: marathonRouter,
})

export type AppRouter = typeof appRouter
export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>
