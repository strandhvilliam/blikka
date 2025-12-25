import { Metadata } from "next"
import { Effect, Schema } from "effect"
import { decodeParams, Page } from "@/lib/next-utils"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Blikka App",
}

const _DomainPage = Effect.fn("@blikka/web/DomainPage")(
  function* ({ params }: PageProps<"/admin/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    //TODO: Replace with check if marathon is onboarded and configured
    const isOnboarded = true

    if (!isOnboarded) {
      return redirect(`/admin/${domain}/onboarding`)
    }

    return redirect(`/admin/${domain}/dashboard`)
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_DomainPage)
