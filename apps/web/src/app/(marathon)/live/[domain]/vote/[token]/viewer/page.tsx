import { batchPrefetch, HydrateClient, fetchServerQuery, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { Splash } from "@/components/splash"
import { VotingClient } from "@/components/live/vote/voting-client"
import { notFound, redirect } from "next/navigation"
import { formatDomainPathname } from "@/lib/utils"
import { getVotingUnavailableReason } from "@/lib/voting-lifecycle"

export default async function VoteViewerPage({
  params,
}: PageProps<"/live/[domain]/vote/[token]/viewer">) {
  const { domain, token } = await params

  const votingSession = await fetchServerQuery(
    trpc.voting.getVotingSession.queryOptions({ token }),
  ).catch((error) => {
    console.error("Failed to fetch voting session:", error)
    notFound()
  })

  const sessionDomain = votingSession.marathon?.domain

  if (sessionDomain && sessionDomain !== domain) {
    return redirect(formatDomainPathname(`/live/vote/${token}/viewer`, sessionDomain, "live"))
  }

  if (votingSession.voteSubmissionId && votingSession.votedAt) {
    return redirect(formatDomainPathname(`/live/vote/${token}/completed`, domain, "live"))
  }

  const unavailableReason = getVotingUnavailableReason({
    startsAt: votingSession.startsAt,
    endsAt: votingSession.endsAt,
  })

  if (unavailableReason) {
    return redirect(
      formatDomainPathname(
        `/live/vote/${token}/unavailable?reason=${unavailableReason}`,
        domain,
        "live",
      ),
    )
  }

  batchPrefetch([
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
    trpc.voting.getVotingSubmissions.queryOptions({ token }),
  ])

  return (
    <HydrateClient>
      <Suspense fallback={<Splash />}>
        <VotingClient domain={domain} token={token} />
      </Suspense>
    </HydrateClient>
  )}
