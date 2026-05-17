import { HydrateClient, prefetch, trpc, fetchServerQuery } from "@/lib/trpc/server"
import { Suspense } from "react"
import { Splash } from "@/components/splash"
import { VoteInitialClient } from "@/components/live/vote/vote-initial-client"
import { notFound, redirect } from "next/navigation"
import { formatDomainPathname } from "@/lib/utils"
import { getVotingUnavailableReason } from "@/lib/voting-lifecycle"

export default async function VotePage({ params }: PageProps<"/live/[domain]/vote/[token]">) {
  const { domain, token } = await params

  prefetch(trpc.voting.getVotingSession.queryOptions({ token }))

  const votingSession = await fetchServerQuery(
    trpc.voting.getVotingSession.queryOptions({ token }),
  ).catch((error) => {
    console.error("Failed to fetch voting session:", error)
    notFound()
  })

  const sessionDomain = votingSession.marathon?.domain

  if (sessionDomain && sessionDomain !== domain) {
    return redirect(formatDomainPathname(`/live/vote/${token}`, sessionDomain, "live"))
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

  return (
    <HydrateClient>
      <Suspense fallback={<Splash />}>
        <VoteInitialClient domain={domain} token={token} />
      </Suspense>
    </HydrateClient>
  )}
