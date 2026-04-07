import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { redirect } from "next/navigation"
import { formatDomainPathname } from "@/lib/utils"

const _JuryInvitationLegacyRedirectPage = Effect.fn("@blikka/web/JuryInvitationLegacyRedirectPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard/jury/[invitationId]">) {
    const { domain, invitationId } = yield* decodeParams(
      Schema.Struct({
        domain: Schema.String,
        invitationId: Schema.String,
      }),
    )(params)

    const parsedId = parseInt(invitationId, 10)
    const basePath = formatDomainPathname("/admin/dashboard/jury", domain)
    if (Number.isNaN(parsedId)) {
      return redirect(basePath)
    }

    return redirect(`${basePath}?invitation=${parsedId}`)
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_JuryInvitationLegacyRedirectPage)
