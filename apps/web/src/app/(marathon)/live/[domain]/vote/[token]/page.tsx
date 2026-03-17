import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import {
  HydrateClient,
  prefetch,
  trpc,
  fetchEffectQuery,
} from "@/lib/trpc/server"
import { Suspense } from "react"
import { Splash } from "@/components/splash"
import { VoteInitialClient } from "./_components/vote-initial-client"
import { notFound, redirect } from "next/navigation"
import { formatDomainPathname } from "@/lib/utils"
import { getVotingUnavailableReason } from "@/lib/voting/voting-lifecycle"

const _VotePage = Effect.fn("@blikka/web/VotePage")(
  function* ({ params }: PageProps<"/live/[domain]/vote/[token]">) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params)

    prefetch(trpc.voting.getVotingSession.queryOptions({ domain, token }))

    const votingSession = yield* fetchEffectQuery(
      trpc.voting.getVotingSession.queryOptions({ domain, token }),
    ).pipe(
      Effect.catch((error) => {
        console.error("Failed to fetch voting session:", error)
        return Effect.fail(notFound())
      }),
    )

    if (votingSession.voteSubmissionId && votingSession.votedAt) {
      return redirect(formatDomainPathname(`/live/vote/${token}/completed`, domain, 'live'))
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
    )
  },
  Effect.catch((error) =>
    Effect.succeed(
      <div>
        Error: {error instanceof Error ? error.message : String(error)}
      </div>,
    ),
  ),
)

export default Page(_VotePage)
