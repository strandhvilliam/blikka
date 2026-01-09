import "server-only"
import { initTRPC, TRPCError } from "@trpc/server"
import { getPermissions, getSession } from "./utils"
import type { ManagedRuntime, Layer } from "effect"
import type { BetterAuthService, Session } from "@blikka/auth"
import type { CoreServices } from "@blikka/runtime"
import { ApiV2Layer } from "../layer"

type ApiV2Services = Layer.Layer.Success<typeof ApiV2Layer>

export type TRPCRequiredServices = CoreServices | ApiV2Services | BetterAuthService

export const createTRPCContext = async <
  T extends ManagedRuntime.ManagedRuntime<TRPCRequiredServices, any>,
>(opts: {
  runtime: T
  headers: Headers
}) => {
  const session = await opts.runtime.runPromise(getSession({ headers: opts.headers }))
  const permissions = await opts.runtime.runPromise(getPermissions({ userId: session?.user.id }))
  const domain = opts.headers.get("x-marathon-domain")

  return { runtime: opts.runtime, session, permissions, domain }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>
export type ContextWithoutRuntime = Omit<Context, "runtime">
export type AuthenticatedContext = Omit<Context, "session"> & { session: Session }
export type AuthenticatedContextWithoutRuntime = Omit<AuthenticatedContext, "runtime">

const t = initTRPC.context<Context>().create()

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

export const publicProcedure = t.procedure

export const authProcedure = t.procedure.use(async ({ next, ctx }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be authenticated to access this resource",
    })
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    } as AuthenticatedContext,
  })
})

export const domainProcedure = t.procedure.use(async ({ next, ctx }) => {
  if (!ctx.domain) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Domain not found in headers",
    })
  }

  if (!ctx.permissions.some((permission) => permission.domain === ctx.domain)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `You are not allowed to access this domain ${ctx.domain}`,
    })
  }

  return next({
    ctx: { ...ctx, domain: ctx.domain } as AuthenticatedContext,
  })
})
