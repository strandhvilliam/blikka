import { initTRPC, TRPCError } from "@trpc/server"
import { Cause, Effect, Layer, ManagedRuntime } from "effect"
import { Database, DbConnectionError, DrizzleClient } from "@blikka/db"
import { BetterAuthService, type Session } from "@blikka/auth"
import { EmailService } from "@blikka/email"
import { getPermissions, getSession } from "./utils"
import { RedisClient } from "@blikka/redis"

export type RequiredServices =
  | BetterAuthService
  | DrizzleClient
  | EmailService
  | Database
  | RedisClient

type HasService<Context, Service> = Service extends Context ? true : false

type ValidateRuntime<T> =
  T extends ManagedRuntime.ManagedRuntime<infer R, infer E>
    ? HasService<R, BetterAuthService> extends false
      ? { __error: "Runtime missing BetterAuthService"; missing: BetterAuthService }
      : HasService<R, DrizzleClient> extends false
        ? { __error: "Runtime missing DrizzleClient"; missing: DrizzleClient }
        : HasService<R, EmailService> extends false
          ? { __error: "Runtime missing EmailService"; missing: EmailService }
          : HasService<R, Database> extends false
            ? { __error: "Runtime missing Database"; missing: Database }
            : HasService<R, RedisClient> extends false
              ? { __error: "Runtime missing RedisClient"; missing: RedisClient }
              : T
    : { __error: "Type must be a ManagedRuntime"; received: T }

type AssertValidRuntime<T> =
  ValidateRuntime<T> extends { __error: infer E }
    ? { __validationError: E; __receivedRuntime: T }
    : unknown

export const createTRPCContext = async <T extends ManagedRuntime.ManagedRuntime<any, any>>(
  opts: {
    runtime: T
    headers: Headers
  } & AssertValidRuntime<T>
) => {
  const session = await opts.runtime.runPromise(getSession({ headers: opts.headers }))
  const permissions = await opts.runtime.runPromise(getPermissions({ userId: session?.user.id }))

  return { runtime: opts.runtime, session, permissions }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>
export type ContextWithoutRuntime = Omit<Context, "runtime">
export type AuthenticatedContext = Omit<Context, "session"> & { session: Session }
export type AuthenticatedContextWithoutRuntime = Omit<AuthenticatedContext, "runtime">

const t = initTRPC.context<Context>().create()

export const createTRPCRouter = t.router

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
