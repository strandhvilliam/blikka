import { Metadata } from "next"
import { Effect, Schema } from "effect"
import { decodeParams, Page } from "@/lib/next-utils"
import { redirect } from "next/navigation"
import { formatDomainPathname } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Blikka App",
}

const _DomainPage = Effect.fn("@blikka/web/DomainPage")(
  function* ({ params }: PageProps<"/admin/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    //TODO: Replace with check if marathon is onboarded and configured
    const isOnboarded = true

    if (!isOnboarded) {
      return redirect(formatDomainPathname(`/admin/onboarding`, domain))
    }

    return redirect(formatDomainPathname(`/admin/dashboard`, domain))
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_DomainPage)
