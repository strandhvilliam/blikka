import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { redirect } from "next/navigation"
import { formatDomainPathname } from "@/lib/utils"

const _StaffAccessLegacyRedirectPage = Effect.fn("@blikka/web/StaffAccessLegacyRedirectPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard/staff/[accessId]">) {
    const { domain, accessId } = yield* decodeParams(
      Schema.Struct({
        domain: Schema.String,
        accessId: Schema.String,
      }),
    )(params)

    const basePath = formatDomainPathname("/admin/dashboard/staff", domain)
    return redirect(`${basePath}?access=${encodeURIComponent(accessId)}`)
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_StaffAccessLegacyRedirectPage)
