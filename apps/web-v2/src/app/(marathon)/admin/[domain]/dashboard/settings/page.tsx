import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { SettingsHeader } from "./_components/settings-header"
import { SettingsSkeleton } from "./_components/settings-skeleton"
import { SettingsForm } from "./_components/settings-form"

const _SettingsPage = Effect.fn("@blikka/web/SettingsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    batchPrefetch([
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
      trpc.marathons.getCurrentTerms.queryOptions({
        domain,
      })
    ])

    return (
      <HydrateClient>
        <Suspense fallback={<SettingsSkeleton />}>
          <div className="container mx-auto p-6 space-y-4 max-w-[1200px]">
            <SettingsHeader />
            <SettingsForm />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_SettingsPage)
