import { decodeParams, Page } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import {
  batchPrefetch,
  HydrateClient, fetchEffectQuery, trpc } from "@/lib/trpc/server";
import { Suspense } from "react";
import { Splash } from "@/components/splash";
import { VotingClient } from "./_components/voting-client";
import { notFound, redirect } from "next/navigation";
import { formatDomainPathname } from "@/lib/utils";

const _VoteViewerPage = Effect.fn("@blikka/web/VoteViewerPage")(
  function* ({ params }: PageProps<"/live/[domain]/vote/[token]/viewer">) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params);


    const votingSession = yield* fetchEffectQuery(
      trpc.voting.getVotingSession.queryOptions({ domain, token }),
    ).pipe(
      Effect.catch((error) => {
        console.error("Failed to fetch voting session:", error);
        return Effect.fail(notFound());
      }),
    );


    if (votingSession.voteSubmissionId && votingSession.votedAt) {
      return redirect(formatDomainPathname(`/live/vote/${token}/completed`, domain, 'live'));
    }

    batchPrefetch([
      trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
      trpc.voting.getVotingSubmissions.queryOptions({ token, domain })
    ]);


    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <VotingClient domain={domain} token={token} />
        </Suspense>
      </HydrateClient>
    );
  },
  Effect.catch((error) =>
    Effect.succeed(
      <div>
        Error: {error instanceof Error ? error.message : String(error)}
      </div>,
    ),
  ),
);

export default Page(_VoteViewerPage);
