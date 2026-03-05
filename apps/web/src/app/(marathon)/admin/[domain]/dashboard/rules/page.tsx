import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { RulesSkeleton } from "./_components/rules-skeleton"
import { RulesForm } from "./_components/rules-form"

const _RulesPage = Effect.fn("@blikka/web/RulesPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.rules.getByDomain.queryOptions({
        domain,
      })
    )
    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<RulesSkeleton />}>
          <div className="container mx-auto p-6 max-w-4xl">
            <RulesForm />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_RulesPage)
