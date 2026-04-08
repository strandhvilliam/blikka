import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { batchPrefetch, HydrateClient, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { Splash } from "@/components/splash"
import { redirect } from "next/navigation"
import { JuryReviewClient } from "@/components/live/jury/jury-review-client"
import { getJuryInvitationForRoute } from "@/lib/jury/jury-server"
import {
  getJuryCompletedPath,
  getJuryEntryPath,
  getJurySubmissionsNextPageParam,
} from "@/lib/jury/jury-utils"

const _JuryViewerPage = Effect.fn("@blikka/web/JuryViewerPage")(
  function* ({ params }: { params: Promise<{ domain: string; token: string }> }) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params)

    const invitation = yield* getJuryInvitationForRoute({ domain, token })

    if (invitation.status === "completed") {
      return redirect(getJuryCompletedPath(domain, token))
    }

    if (invitation.status === "pending") {
      return redirect(getJuryEntryPath(domain, token))
    }

    batchPrefetch([
      trpc.jury.getJuryRatingsByInvitation.queryOptions({ domain, token }),
      trpc.jury.getJuryParticipantCount.queryOptions({ domain, token }),
      trpc.jury.getJurySubmissionsFromToken.infiniteQueryOptions(
        { domain, token },
        { getNextPageParam: getJurySubmissionsNextPageParam },
      ),
    ])

    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <JuryReviewClient />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>),
  ),
)

export default Page(_JuryViewerPage)
