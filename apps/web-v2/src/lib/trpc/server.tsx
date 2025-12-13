import "server-only"

import type { TRPCQueryOptions } from "@trpc/tanstack-react-query"
import { cache } from "react"
import { headers } from "next/headers"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import { Data, Effect } from "effect"

import { appRouter, type AppRouter } from "@blikka/api-v2/trpc/routers/_app"
import { createQueryClient } from "./query-client"
import { createTRPCContext } from "@blikka/api-v2/trpc"
import { serverRuntime } from "../runtime"

export class TRPCServerError extends Data.TaggedError("TRPCClientError")<{
  message: string
  cause?: unknown
}> {}

export const getQueryClient = cache(createQueryClient)

const createContext = cache(async () => {
  const heads = new Headers(await headers())

  return createTRPCContext({
    headers: heads,
    runtime: serverRuntime,
  })
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  queryClient: getQueryClient,
  router: appRouter,
  ctx: createContext,
})

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return <HydrationBoundary state={dehydrate(queryClient)}>{props.children}</HydrationBoundary>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T) {
  const queryClient = getQueryClient()
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void queryClient.prefetchInfiniteQuery(queryOptions as any)
  } else {
    void queryClient.prefetchQuery(queryOptions)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function batchPrefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptionsArray: T[]) {
  const queryClient = getQueryClient()

  for (const queryOptions of queryOptionsArray) {
    if (queryOptions.queryKey[1]?.type === "infinite") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void queryClient.prefetchInfiniteQuery(queryOptions as any)
    } else {
      void queryClient.prefetchQuery(queryOptions)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fetchEffectQuery<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T) {
  const queryClient = getQueryClient()

  return Effect.tryPromise({
    try: () => queryClient.fetchQuery(queryOptions),
    catch: (error) =>
      new TRPCServerError({
        message: error instanceof Error ? error.message : "TRPC call failed",
        cause: error,
      }),
  })
}
