"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { createTRPCClient, httpBatchStreamLink, loggerLink, TRPCLink } from "@trpc/client"
import { createTRPCContext } from "@trpc/tanstack-react-query"

import type { AppRouter } from "@blikka/api-v2/trpc/routers/_app"

import { createQueryClient } from "./query-client"
import { observable } from "@trpc/server/observable"
import { useRouter } from "next/navigation"
import { NextRouter } from "next/router"

let clientQueryClientSingleton: QueryClient | undefined = undefined
const getQueryClient = (unauthorizedCallback: () => void) => {
  if (typeof window === "undefined") {
    return createQueryClient()
  } else {
    return (clientQueryClientSingleton ??= createQueryClient(unauthorizedCallback))
  }
}

export const { useTRPC, TRPCProvider } = createTRPCContext<AppRouter>()

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const router = useRouter()
  const unauthorizedCallback = () => {
    console.log("UNAUTHORIZED")
    router.replace("/auth/login")
  }
  const queryClient = getQueryClient(unauthorizedCallback)

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          url: getBaseUrl() + "/api/trpc",
          async headers() {
            const headers = new Headers()
            headers.set("x-trpc-source", "blikka-web-client")
            return headers
          },
        }),
      ],
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}

const getBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}
