import { Effect, Schema } from "effect"
import { RuntimeDependencies } from "./runtime"
import { connection } from "next/server"
import { serverRuntime } from "./runtime"
import { Exit, Chunk, Cause } from "effect"
import { unstable_rethrow } from "next/navigation"
import { Suspense, use } from "react"

type NextBaseParams = Promise<Record<string, string | Array<string> | undefined>>

type NextBaseSearchParams = Promise<Record<string, string | Array<string> | undefined>>

export type ActionResponse<T> = T extends void
  ? {
      data: undefined
      error: string | null
    }
  : {
      data: T
      error: string | null
    }

export const decodeParams =
  <T, P extends NextBaseParams>(schema: Schema.Schema<T>) =>
  (p: P) =>
    Effect.gen(function* () {
      const params = yield* Effect.promise(() => p)
      return yield* Schema.decodeUnknown(schema)(params)
    })

export const decodeSearchParams =
  <T, P extends NextBaseSearchParams>(schema: Schema.Schema<T>) =>
  (search: P) =>
    Effect.gen(function* () {
      const searchParams = yield* Effect.promise(() => search)
      return yield* Schema.decodeUnknown(schema)(searchParams)
    })

export function toActionResponse<T>(
  effect: Effect.Effect<T, unknown, RuntimeDependencies>
): Effect.Effect<ActionResponse<T>, never, RuntimeDependencies> {
  return effect.pipe(
    Effect.map((data) => ({ data, error: null as string | null }) as ActionResponse<T>),
    Effect.tapError((error) => Effect.logError(error)),
    Effect.catchAll((error) =>
      Effect.succeed({
        data: undefined as T extends void ? undefined : T,
        error: error instanceof Error ? error.message : String(error),
      } as ActionResponse<T>)
    )
  )
}

function Next<I extends Array<unknown>, A>(
  effectFn: (...args: I) => Effect.Effect<A, never, RuntimeDependencies>
) {
  return async (...args: I): Promise<A> => {
    return serverRuntime.runPromiseExit(effectFn(...args)).then((res) => {
      if (Exit.isFailure(res)) {
        const defects = Chunk.toArray(Cause.defects(res.cause))

        if (defects.length === 1) {
          unstable_rethrow(defects[0])
        }

        const errors = Cause.prettyErrors(res.cause)
        throw errors[0]
      }

      return res.value
    })
  }
}

function NextSuspense<I extends Array<unknown>, A>(
  effectFn: (...args: I) => Effect.Effect<A, never, RuntimeDependencies>
) {
  return (...args: I): A =>
    use(
      (async () => {
        await connection()
        const res = await serverRuntime.runPromiseExit(effectFn(...args))
        if (Exit.isFailure(res)) {
          const defects = Chunk.toArray(Cause.defects(res.cause))

          if (defects.length === 1) {
            unstable_rethrow(defects[0])
          }

          const errors = Cause.prettyErrors(res.cause)
          throw errors[0]
        }

        return res.value
      })()
    )
}

function LayoutSuspense<I extends Array<unknown>, A>(
  effectFn: (...args: I) => Effect.Effect<A, never, RuntimeDependencies>
) {
  const ComponentWithData = NextSuspense(effectFn)
  return function SuspenseLayout(
    props: I extends [] ? { children?: unknown } : I extends [infer P] ? P : unknown
  ) {
    return (
      <Suspense fallback={null}>
        {/* @ts-expect-error passthrough props shape depends on caller */}
        <ComponentWithData {...(props as unknown as I[number])} />
      </Suspense>
    )
  }
}

export const Page = NextSuspense
export const Component = NextSuspense
export const Layout = LayoutSuspense

export const Route = Next
export const Action = Next
