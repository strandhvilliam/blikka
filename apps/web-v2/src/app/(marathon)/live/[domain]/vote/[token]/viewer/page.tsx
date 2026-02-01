import { decodeParams, Page } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";
import { Suspense } from "react";
import { Splash } from "@/components/splash";
import { VotingClient } from "./_components/voting-client";

const _VoteViewerPage = Effect.fn("@blikka/web/VoteViewerPage")(
  function* ({ params }: PageProps<"/live/[domain]/vote/[token]/viewer">) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params);

    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }));

    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <VotingClient domain={domain} token={token} />
        </Suspense>
      </HydrateClient>
    );
  },
  Effect.catchAll((error) =>
    Effect.succeed(
      <div>
        Error: {error instanceof Error ? error.message : String(error)}
      </div>,
    ),
  ),
);

export default Page(_VoteViewerPage);
