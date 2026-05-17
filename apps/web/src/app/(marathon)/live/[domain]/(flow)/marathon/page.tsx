import { Suspense } from "react";
import { HydrateClient } from "@/lib/trpc/server";
import { MarathonClientWrapper } from "@/components/live/flow/marathon-client-wrapper";

import { prefetch, trpc } from "@/lib/trpc/server";
import { StepStateProvider } from "@/lib/flow/step-state-context";
import { Splash } from "@/components/splash";

export default async function MarathonPage({ params }: PageProps<"/live/[domain]">) {
  const { domain } = await params
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
}
