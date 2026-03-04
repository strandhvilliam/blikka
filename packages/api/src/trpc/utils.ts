import { Cause, Effect, Option } from "effect"
import { type BaseContext, type TRPCRequiredServices } from "./root"
import { TRPCError } from "@trpc/server"
import { BetterAuthService } from "@blikka/auth"
import { Database } from "@blikka/db"
import { RedisClient } from "@blikka/redis"

type ContextWithoutRuntimeHelper<T extends BaseContext> = Omit<T, "runtime">

export function trpcEffect<
  TInput,
  A,
  E = never,
  R extends TRPCRequiredServices = TRPCRequiredServices,
  TCtx extends BaseContext = BaseContext,
>(
  effectFn: (params: {
    input: TInput
    ctx: ContextWithoutRuntimeHelper<TCtx>
  }) => Effect.Effect<A, E, R>
) {
  return async (params: { input: TInput; ctx: TCtx }): Promise<A> => {
    const { runtime, ...ctxRest } = params.ctx
    const exit = await runtime.runPromiseExit(
      effectFn({
        input: params.input,
        ctx: ctxRest as ContextWithoutRuntimeHelper<TCtx>,
      })
    )

    if (exit._tag === "Failure") {
      const error = Cause.squash(exit.cause)
      throw mapEffectErrorToTRPC(error)
    }
    return exit.value
  }
}

function mapEffectErrorToTRPC(error: unknown): TRPCError {
  console.error(error)
  if (error instanceof TRPCError) {
    return error
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : "An unknown error occurred",
    cause: error,
  })
}

export const getSession = Effect.fnUntraced(function* ({ headers }: { headers: Headers }) {
  const auth = yield* BetterAuthService



  return yield* Effect.tryPromise({
    try: () =>
      auth.api.getSession({
        headers,
      }),
    catch: (error) =>
      Effect.fail(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "An unknown error occurred",
          cause: error,
        })
      ),
  })
})

export type Permission = {
  userId: string
  relationId: number
  marathonId: number
  domain: string
  role: string
}

export const getPermissions = Effect.fn("ApiContextUtils.getPermissions")(function* ({
  userId,
}: {
  userId?: string
}) {
  const redis = yield* RedisClient
  const db = yield* Database

  if (!userId) {
    return []
  }
  const result = yield* redis
    .use((client) => client.get<Permission[] | null>(`permissions:${userId}`))
    .pipe(
      Effect.map(Option.fromNullishOr),
      Effect.tapError((error) =>
        Effect.logError("Error getting cached permissions: " + error.message)
      )
    )

  if (Option.isSome(result)) {
    return result.value
  }
  const userWithMarathons = yield* db.usersQueries.getUserWithMarathons({ userId }).pipe(
    Effect.tapError((error) =>
      Effect.logError("Error getting user with marathons: " + error.message)
    ),
  )
  if (Option.isNone(userWithMarathons)) {
    return []
  }
  const user = userWithMarathons.value.userMarathons

  const permissions: Permission[] = user.map((userMarathon) => ({
    userId: userMarathon.userId,
    relationId: userMarathon.id,
    marathonId: userMarathon.marathonId,
    domain: userMarathon.marathon.domain,
    role: userMarathon.role,
  }))

  yield* redis
    .use((client) => client.set(`permissions:${userId}`, permissions, { ex: 60 * 5 }))
    .pipe(
      Effect.tapError((error) => Effect.logError("Error caching permissions: " + error.message))
    )
  return permissions
})
