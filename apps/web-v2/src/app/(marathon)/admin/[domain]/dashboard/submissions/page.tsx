import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { SubmissionsTable } from "./_components/submissions-table"
import { Suspense } from "react"
import { loadSubmissionSearchParams } from "./_lib/search-params"

const _SubmissionsPage = Effect.fn("@blikka/web/SubmissionsPage")(
  function* ({ params, searchParams }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const queryParams = yield* Effect.tryPromise(() => loadSubmissionSearchParams(searchParams))
    prefetch(
      trpc.participants.getByDomainInfinite.queryOptions({
        domain,
        cursor: null,
        limit: 50,
        search: queryParams.search,
        sortOrder: queryParams.sortOrder,
        competitionClassId: queryParams.competitionClassId,
        deviceGroupId: queryParams.deviceGroupId,
        statusFilter: null,
        excludeStatuses: null,
        hasValidationErrors: null,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<div>Loading...</div>}>
          <SubmissionsTable />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_SubmissionsPage)
