import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { Splash } from "@/components/splash"
import { redirect } from "next/navigation"
import { JuryInitialClient } from "@/components/live/jury/jury-initial-client"
import { getJuryInvitationForRoute } from "@/lib/jury/jury-server"
import { getJuryCompletedPath, getJuryViewerPath } from "@/lib/jury/jury-utils"

export default async function JuryPage({
  params,
}: {
  params: Promise<{ domain: string; token: string }>
}) {
  const { domain, token } = await params

  const invitation = await getJuryInvitationForRoute({ domain, token })

  if (invitation.status === "completed") {
    return redirect(getJuryCompletedPath(domain, token))
  }

  if (invitation.status === "in_progress") {
    return redirect(getJuryViewerPath(domain, token))
  }

  return (
    <HydrateClient>
      <Suspense fallback={<Splash />}>
        <JuryInitialClient domain={domain} token={token} />
      </Suspense>
    </HydrateClient>
  )}
