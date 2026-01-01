import "server-only"
import { initTRPC, TRPCError } from "@trpc/server"
import { getPermissions, getSession } from "./utils"
import type { ManagedRuntime } from "effect"
import type { Database, DrizzleClient } from "@blikka/db"
import type { BetterAuthService, Session } from "@blikka/auth"
import type { EmailService } from "@blikka/email"
import type { RedisClient } from "@blikka/redis"
import type { S3Service } from "@blikka/s3"
import type { UploadSessionRepository } from "@blikka/kv-store"
import type { PubSubService, RunStateService } from "@blikka/pubsub"
import type { ValidationEngine } from "@blikka/validation"
import type { ContactSheetBuilder, SharpImageService } from "@blikka/image-manipulation"
import type { UploadFlowService } from "./routers/upload-flow/service"
import type { ContactSheetsService } from "./routers/contact-sheets/service"

export type RequiredServices =
  | BetterAuthService
  | DrizzleClient
  | EmailService
  | Database
  | RedisClient
  | S3Service
  | UploadSessionRepository
  | PubSubService
  | RunStateService
  | ValidationEngine
  | ContactSheetBuilder
  | SharpImageService
  | UploadFlowService
  | ContactSheetsService

type ServiceMap = {
  BetterAuthService: BetterAuthService
  DrizzleClient: DrizzleClient
  EmailService: EmailService
  Database: Database
  RedisClient: RedisClient
  S3Service: S3Service
  UploadSessionRepository: UploadSessionRepository
  PubSubService: PubSubService
  RunStateService: RunStateService
  ValidationEngine: ValidationEngine
  ContactSheetBuilder: ContactSheetBuilder
  SharpImageService: SharpImageService
  UploadFlowService: UploadFlowService
}

type ServiceNames = keyof ServiceMap

type HasService<Context, Service> = Service extends Context ? true : false

type CheckService<Context, Name extends ServiceNames> =
  HasService<Context, ServiceMap[Name]> extends false
    ? { __error: `Runtime missing ${Name}`; missing: ServiceMap[Name] }
    : true

type ValidateServices<Context, Names extends readonly ServiceNames[]> = Names extends readonly [
  infer First extends ServiceNames,
  ...infer Rest extends readonly ServiceNames[],
]
  ? CheckService<Context, First> extends { __error: infer E; missing: infer M }
    ? { __error: E; missing: M }
    : ValidateServices<Context, Rest>
  : true

type ValidateRuntime<T> =
  T extends ManagedRuntime.ManagedRuntime<infer R, infer E>
    ? ValidateServices<
        R,
        [
          "BetterAuthService",
          "DrizzleClient",
          "EmailService",
          "Database",
          "RedisClient",
          "S3Service",
          "UploadSessionRepository",
          "PubSubService",
          "RunStateService",
          "ValidationEngine",
          "ContactSheetBuilder",
          "SharpImageService",
          "UploadFlowService",
        ]
      >
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
