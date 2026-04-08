import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { Splash } from "@/components/splash"
import { redirect } from "next/navigation"
import { JuryInitialClient } from "./_components/jury-initial-client"
import { getJuryInvitationForRoute } from "./_lib/jury-route"
import { getJuryCompletedPath, getJuryViewerPath } from "./_lib/jury-utils"

const _JuryPage = Effect.fn("@blikka/web/JuryPage")(
  function* ({
    params,
  }: {
    params: Promise<{ domain: string; token: string }>
  }) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params)

    const invitation = yield* getJuryInvitationForRoute({ domain, token })

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

export default Page(_JuryPage)
