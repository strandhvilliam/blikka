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

export default async function JuryViewerPage({
  params,
}: {
  params: Promise<{ domain: string; token: string }>
}) {
  const { domain, token } = await params

  const invitation = await getJuryInvitationForRoute({ domain, token })

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
      // @ts-expect-error - TODO: fix this
      { getNextPageParam: getJurySubmissionsNextPageParam },
    ),
  ])

  return (
    <HydrateClient>
      <Suspense fallback={<Splash />}>
        <JuryReviewClient />
      </Suspense>
    </HydrateClient>
  )}
