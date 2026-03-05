import "server-only"
import { Effect, Schema } from "effect"
import type { RuntimeDependencies } from "./runtime"
import { connection } from "next/server"
import { serverRuntime } from "./runtime"
import { Exit, Cause } from "effect"
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
  <S extends Schema.Top>(schema: S) =>
  <P extends NextBaseParams>(p: P) =>
    Effect.gen(function* () {
      const params = yield* Effect.promise(() => p)
      return yield* Schema.decodeUnknownEffect(schema)(params)
    })

export const decodeSearchParams =
  <S extends Schema.Top>(schema: S) =>
  <P extends NextBaseSearchParams>(search: P) =>
    Effect.gen(function* () {
      const searchParams = yield* Effect.promise(() => search)
      return yield* Schema.decodeUnknownEffect(schema)(searchParams)
    })

export function toActionResponse<T>(
  effect: Effect.Effect<T, unknown, RuntimeDependencies>
): Effect.Effect<ActionResponse<T>, never, RuntimeDependencies> {
  return effect.pipe(
    Effect.map((data) => ({ data, error: null as string | null }) as ActionResponse<T>),
    Effect.tapError((error) => Effect.logError(error)),
    Effect.catch((error) =>
      Effect.succeed({
        data: undefined as T extends void ? undefined : T,
        error: error instanceof Error ? error.message : String(error),
      } as ActionResponse<T>)
    )
  )
}

function Next<I extends Array<unknown>, A, E>(
  effectFn: (...args: I) => Effect.Effect<A, E, RuntimeDependencies>
) {
  return async (...args: I): Promise<A> => {
    return serverRuntime.runPromiseExit(effectFn(...args)).then((res) => {
      if (Exit.isFailure(res)) {
        const defects = res.cause.reasons.filter(Cause.isDieReason)

        if (defects.length === 1) {
          unstable_rethrow(defects[0].defect)
        }

        const errors = Cause.prettyErrors(res.cause)
        throw errors[0]
      }

      return res.value
    })
  }
}

function NextSuspense<I extends Array<unknown>, A, E>(
  effectFn: (...args: I) => Effect.Effect<A, E, RuntimeDependencies>
) {
  return (...args: I): A =>
    use(
      (async () => {
        await connection()
        const res = await serverRuntime.runPromiseExit(effectFn(...args))
        if (Exit.isFailure(res)) {
          const defects = res.cause.reasons.filter(Cause.isDieReason)

          if (defects.length === 1) {
            unstable_rethrow(defects[0].defect)
          }

          const errors = Cause.prettyErrors(res.cause)
          throw errors[0]
        }

        return res.value
      })()
    )
}

function LayoutSuspense<I extends Array<unknown>, A, E>(
  effectFn: (...args: I) => Effect.Effect<A, E, RuntimeDependencies>
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
