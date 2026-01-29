import { decodeParams, Page } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";
import { Suspense } from "react";
import { Splash } from "@/components/splash";
import { VotingClient } from "./_components/voting-client";

const _VoteSubmissionsPage = Effect.fn("@blikka/web/VoteSubmissionsPage")(
  function*({ params }: PageProps<"/live/[domain]/vote/[token]/submissions">) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params);

    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }));

    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <VotingClient domain={domain} />
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

export default Page(_VoteSubmissionsPage);
