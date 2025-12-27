import { defaultShouldDehydrateQuery, QueryCache, QueryClient } from "@tanstack/react-query"
import { TRPCClientError } from "@trpc/client"
import { redirect } from "next/navigation"
import SuperJSON from "superjson"

export const createQueryClient = (unauthorizedCallback?: () => void) =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof TRPCClientError) {
          if (error.data.code === "UNAUTHORIZED") {
            unauthorizedCallback?.()
          }
        }
      },
    }),
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 1000 * 60 * 5, // 5 minutes
      },

      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        shouldRedactErrors: () => {
          // We should not catch Next.js server errors
          // as that's how Next.js detects dynamic pages
          // so we cannot redact them.
          // Next.js also automatically redacts errors for us
          // with better digests.
          return false
        },
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  })
