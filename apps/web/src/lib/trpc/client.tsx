"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { createTRPCClient, httpBatchStreamLink, loggerLink } from "@trpc/client"
import { createTRPCContext } from "@trpc/tanstack-react-query"

import type { AppRouter } from "@blikka/api/trpc"

import { createQueryClient } from "./query-client"
import { marathonDomainFromLocation } from "@/lib/marathon-domain"

function domainForTrpcHeader(fromServerLayout: string | null): string | null {
  if (typeof window !== "undefined") {
    return (
      marathonDomainFromLocation({
        host: window.location.host,
        href: window.location.href,
        pathname: window.location.pathname,
      }) ?? fromServerLayout
    )
  }
  return fromServerLayout
}

/** Props read on each outbound tRPC HTTP call (client is created once; values stay fresh via `useLatest`). */
type MarathonTrpcLinkProps = {
  domain: string | null
  requestCookieHeader: string | null
}

function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

function marathonTrpcFetchHeaders(latest: MarathonTrpcLinkProps): Headers {
  const headers = new Headers()
  const domain = domainForTrpcHeader(latest.domain)
  headers.set("x-trpc-source", "blikka-web-client")
  if (domain) {
    headers.set("x-marathon-domain", domain)
  }
  // Fixes SSR permission errors
  if (typeof window === "undefined" && latest.requestCookieHeader) {
    headers.set("cookie", latest.requestCookieHeader)
  }
  return headers
}

let clientQueryClientSingleton: QueryClient | undefined = undefined

const getQueryClient = (/*unauthorizedCallback: () => void*/) => {
  if (typeof window === "undefined") {
    return createQueryClient()
  } else {
    return (clientQueryClientSingleton ??= createQueryClient(/*unauthorizedCallback*/))
  }
}

export const { useTRPC, TRPCProvider } = createTRPCContext<AppRouter>()

export function TRPCReactProvider(props: {
  children: React.ReactNode
  domain: string | null
  /** Set from server layout via `headers().get("cookie")` so RSC/SSR fetches to `/api/trpc` stay authenticated. */
  requestCookieHeader?: string | null
}) {
  const queryClient = getQueryClient(/*unauthorizedCallback*/)

  const latestLinkProps = useLatest<MarathonTrpcLinkProps>({
    domain: props.domain,
    requestCookieHeader: props.requestCookieHeader ?? null,
  })

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
          headers() {
            return marathonTrpcFetchHeaders(latestLinkProps.current)
          },
        }),
      ],
    }),
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
