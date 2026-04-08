import { decodeParams } from "@/lib/next-utils";
import { Suspense } from "react";
import { Effect, Schema } from "effect";
import { HydrateClient } from "@/lib/trpc/server";
import { MarathonClientWrapper } from "@/components/live/flow/marathon-client-wrapper";
import { Page } from "@/lib/next-utils";
import { prefetch, trpc } from "@/lib/trpc/server";
import { StepStateProvider } from "@/lib/flow/step-state-context";
import { Splash } from "@/components/splash";

const _MarathonPage = Effect.fn("@blikka/web/MarathonPage")(
  function* ({ params }: PageProps<"/live/[domain]">) {
    const { domain } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String }),
    )(params);
    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }));
    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <StepStateProvider flowVariant="upload">
            <MarathonClientWrapper />
          </StepStateProvider>
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

export default Page(_MarathonPage);
