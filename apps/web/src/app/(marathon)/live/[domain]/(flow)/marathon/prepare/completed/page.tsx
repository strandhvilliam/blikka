import { flowStateServerLoader } from "@/lib/flow-state-params-server";
import { notFound } from "next/navigation";

import { PrepareCompletedClient } from "@/components/live/flow/prepare-completed-client";

export default async function PrepareCompletedPage({
  params,
  searchParams,
}: PageProps<"/live/[domain]">) {
  const { domain } = await params
  const queryParams = await flowStateServerLoader(searchParams);

  if (!queryParams?.participantRef) {
    return notFound();
  }

  return (
    <PrepareCompletedClient
      domain={domain}
      params={{
        participantRef: queryParams.participantRef,
        participantFirstName: queryParams.participantFirstName ?? "",
        participantLastName: queryParams.participantLastName ?? "",
        participantEmail: queryParams.participantEmail ?? "",
      }}
    />
  );}
