import { Cause, Effect, Option, Schema, SchemaIssue } from 'effect'
import { type BaseContext, type TRPCRequiredServices } from './root'
import { TRPCError } from '@trpc/server'
import { BetterAuthService } from '@blikka/auth'
import { UsersRepository } from '@blikka/db'
import { RedisClient } from '@blikka/redis'
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalApiError,
  NotFoundError,
  PreconditionFailedError,
  UnauthorizedError,
} from '../core/errors'

const apiErrorToTrpc = {
  NotFoundError: (e: NotFoundError) =>
    new TRPCError({ code: 'NOT_FOUND', message: e.message, cause: e }),
  BadRequestError: (e: BadRequestError) =>
    new TRPCError({ code: 'BAD_REQUEST', message: e.message, cause: e }),
  UnauthorizedError: (e: UnauthorizedError) =>
    new TRPCError({ code: 'UNAUTHORIZED', message: e.message, cause: e }),
  ForbiddenError: (e: ForbiddenError) =>
    new TRPCError({ code: 'FORBIDDEN', message: e.message, cause: e }),
  ConflictError: (e: ConflictError) =>
    new TRPCError({ code: 'CONFLICT', message: e.message, cause: e }),
  PreconditionFailedError: (e: PreconditionFailedError) =>
    new TRPCError({ code: 'PRECONDITION_FAILED', message: e.message, cause: e }),
  InternalApiError: (e: InternalApiError) =>
    new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: e.message,
      cause: e,
    }),
} as const

type ContextWithoutRuntimeHelper<T extends BaseContext> = Omit<T, 'runtime'>

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
  }) => Effect.Effect<A, E, R>,
) {
  return async (params: { input: TInput; ctx: TCtx }): Promise<A> => {
    const { runtime, ...ctxRest } = params.ctx
    const exit = await runtime.runPromiseExit(
      effectFn({
        input: params.input,
        ctx: ctxRest as ContextWithoutRuntimeHelper<TCtx>,
      }),
    )

    if (exit._tag === 'Failure') {
      const error = Cause.squash(exit.cause)
      throw mapEffectErrorToTRPC(error, exit.cause)
    }
    return exit.value
  }
}

function mapEffectErrorToTRPC(error: unknown, cause?: Cause.Cause<unknown>): TRPCError {
  if (error instanceof TRPCError) {
    return error
  }
  if (error instanceof NotFoundError) return apiErrorToTrpc.NotFoundError(error)
  if (error instanceof BadRequestError) return apiErrorToTrpc.BadRequestError(error)
  if (error instanceof UnauthorizedError) {
    return apiErrorToTrpc.UnauthorizedError(error)
  }
  if (error instanceof ForbiddenError) return apiErrorToTrpc.ForbiddenError(error)
  if (error instanceof ConflictError) return apiErrorToTrpc.ConflictError(error)
  if (error instanceof PreconditionFailedError) {
    return apiErrorToTrpc.PreconditionFailedError(error)
  }
  if (error instanceof InternalApiError) {
    return apiErrorToTrpc.InternalApiError(error)
  }
  if (Schema.isSchemaError(error)) {
    const formatted = SchemaIssue.makeFormatterDefault()(error.issue)
    console.error(`SchemaError: ${formatted}`)
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
      cause: error,
    })
  }
  if (cause) {
    console.error(Cause.pretty(cause))
  } else {
    console.error(error instanceof Error ? error.message : String(error))
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'An unknown error occurred',
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
      new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        cause: error,
      }),
  })
})

export type Permission = {
  userId: string
  relationId: number
  marathonId: number
  domain: string
  role: string
}

export const getPermissions = Effect.fn('ApiContextUtils.getPermissions')(function* ({
  userId,
}: {
  userId?: string
}) {
  const redis = yield* RedisClient
  const usersRepository = yield* UsersRepository

  if (!userId) {
    return []
  }
  const result = yield* redis
    .use((client) => client.get<Permission[] | null>(`permissions:${userId}`))
    .pipe(
      Effect.map(Option.fromNullishOr),
      Effect.tapError((error) =>
        Effect.logError('Error getting cached permissions: ' + error.message),
      ),
    )

  if (Option.isSome(result)) {
    return result.value
  }
  const userWithMarathons = yield* usersRepository
    .getUserWithMarathons({ userId })
    .pipe(
      Effect.tapError((error) =>
        Effect.logError('Error getting user with marathons: ' + error.message),
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
      Effect.tapError((error) => Effect.logError('Error caching permissions: ' + error.message)),
    )
  return permissions
})
