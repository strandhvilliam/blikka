import { decodeParams, Layout } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { prefetch, HydrateClient, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { JuryList } from "./_components/jury-list"
import { JuryListSkeleton } from "./_components/jury-list-skeleton"
import { JuryLayoutContent } from "./_components/jury-layout-content"

const _JuryLayout = Effect.fn("@blikka/web/JuryLayout")(
  function* ({ children, params }: LayoutProps<"/admin/[domain]/dashboard/jury">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.jury.getJuryInvitationsByDomain.queryOptions({
        domain,
      })
    )

    prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))

    return (
      <HydrateClient>
        <JuryLayoutContent>
          <Suspense fallback={<JuryListSkeleton />}>
            <JuryList />
          </Suspense>
          {children}
        </JuryLayoutContent>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Layout(_JuryLayout)

