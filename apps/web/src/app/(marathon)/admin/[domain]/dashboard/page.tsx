import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import {
  fetchEffectQuery,
  HydrateClient,
  prefetch,
  trpc,
} from "@/lib/trpc/server"
import { Suspense } from "react"
import { DashboardHomeContent } from "./_components/dashboard-home-content"
import { DashboardHomeSkeleton } from "./_components/dashboard-home-skeleton"

const _DashboardPage = Effect.fn("@blikka/web/DashboardPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    const marathon = yield* fetchEffectQuery(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )
    prefetch(
      trpc.participants.getDashboardOverview.queryOptions({
        domain,
      }),
    )
    prefetch(
      trpc.users.getStaffMembersByDomain.queryOptions({
        domain,
      }),
    )
    prefetch(
      trpc.jury.getJuryInvitationsByDomain.queryOptions({
        domain,
      }),
    )

    if (marathon.mode === "by-camera") {
      const activeTopic = marathon.topics.find((topic) => topic.visibility === "active")

      if (activeTopic) {
        prefetch(
          trpc.voting.getVotingAdminSummary.queryOptions({
            domain,
            topicId: activeTopic.id,
          }),
        )
      }
    }

    return (
      <HydrateClient>
        <Suspense fallback={<DashboardHomeSkeleton />}>
          <DashboardHomeContent />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_DashboardPage)
