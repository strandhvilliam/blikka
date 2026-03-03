import "server-only"
import { initTRPC, TRPCError } from "@trpc/server"
import { getPermissions, getSession, type Permission } from "./utils"
import type { ManagedRuntime, Layer } from "effect"
import type { BetterAuthService, Session } from "@blikka/auth"
import type { CoreServices } from "@blikka/runtime"
import { ApiLayer } from "../layer"

type ApiServices = Layer.Layer.Success<typeof ApiLayer>

export type TRPCRequiredServices = CoreServices | ApiServices | BetterAuthService

export const createTRPCContext = async <
  T extends ManagedRuntime.ManagedRuntime<TRPCRequiredServices, any>,
>({
  runtime,
  headers,
}: {
  runtime: T
  headers: Headers
}) => {
  const session = await runtime.runPromise(getSession({ headers }))

  const permissions = await runtime.runPromise(getPermissions({ userId: session?.user.id }))
  const domain = headers.get("x-marathon-domain")

  return { runtime, session, permissions, domain }
}

export type BaseContext = {
  runtime: ManagedRuntime.ManagedRuntime<TRPCRequiredServices, any>
  permissions: Permission[]
  session: Session | null
  domain: string | null
}

export type AuthenticatedContext = BaseContext & {
  session: Session
}

export type DomainContext = AuthenticatedContext & {
  domain: string
}

const t = initTRPC.context<BaseContext>().create()

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

export const domainProcedure = authProcedure.use(async ({ next, ctx }) => {
  if (!ctx.domain) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Domain header is required for this endpoint",
    })
  }

  if (!ctx.permissions.some((permission) => permission.domain === ctx.domain)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have access to domain: ${ctx.domain}`,
    })
  }

  return next({
    ctx: {
      ...ctx,
      domain: ctx.domain,
    } as DomainContext,
  })
})
