import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { prefetch, HydrateClient, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { JuryInvitationDetailsContent } from "./_components/jury-invitation-details-content"
import { JuryInvitationDetailsSkeleton } from "./_components/jury-invitation-details-skeleton"

const _JuryInvitationDetailsPage = Effect.fn("@blikka/web/JuryInvitationDetailsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard/jury/[invitationId]">) {
    const { domain, invitationId } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, invitationId: Schema.String })
    )(params)

    const parsedId = parseInt(invitationId)

    prefetch(
      trpc.jury.getJuryInvitationById.queryOptions({
        id: parsedId,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<JuryInvitationDetailsSkeleton />}>
          <JuryInvitationDetailsContent invitationId={parsedId} />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_JuryInvitationDetailsPage)

