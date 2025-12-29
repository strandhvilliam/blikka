import { DomainProvider } from "@/lib/domain-provider"
import { decodeParams, Layout } from "@/lib/next-utils"
import { Effect, Schema } from "effect"

const _DomainAdminLayout = Effect.fn("@blikka/web/DomainAdminLayout")(
  function* ({ children, params }: LayoutProps<"/admin/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    return <DomainProvider domain={domain}>{children}</DomainProvider>
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Layout(_DomainAdminLayout)
