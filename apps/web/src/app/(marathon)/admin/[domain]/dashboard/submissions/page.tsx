import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { fetchEffectQuery, HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { SubmissionsTable } from "./_components/submissions-table"
import { Suspense } from "react"
import { loadSubmissionSearchParams } from "./_lib/search-params"
import { SubmissionsHeader } from "./_components/submissions-header"
import { SubmissionsSkeleton } from "./_components/submissions-skeleton"

const _SubmissionsPage = Effect.fn("@blikka/web/SubmissionsPage")(
  function* ({ params, searchParams }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const marathon = yield* fetchEffectQuery(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )
    const activeByCameraTopic =
      marathon.mode === "by-camera"
        ? (marathon.topics.find((topic) => topic.visibility === "active") ?? null)
        : null
    const activeByCameraTopicId =
      marathon.mode === "by-camera" ? (activeByCameraTopic?.id ?? -1) : null
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
        topicId: activeByCameraTopicId,
        statusFilter: null,
        excludeStatuses: null,
        hasValidationErrors: null,
        includeStatuses: null,
        votedFilter: null,
      }),
    )

    return (
      <HydrateClient>
        <Suspense fallback={<SubmissionsSkeleton />}>
          <div className="container mx-auto h-full flex flex-col">
            <div className="shrink-0 mb-6">
              <SubmissionsHeader />
            </div>
            <div className="flex-1 min-h-0">
              <SubmissionsTable />
            </div>
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_SubmissionsPage)
