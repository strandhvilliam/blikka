import { decodeParams, Page } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";
import { Suspense } from "react";
import { Splash } from "@/components/splash";

const _VotePage = Effect.fn("@blikka/web/VotePage")(
  function*({ params }: PageProps<"/live/[domain]/vote/[token]">) {
    const { domain } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String }),
    )(params);

    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }));

    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <div>Inital page</div>
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

export default Page(_VotePage);
