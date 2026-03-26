import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { SettingsSkeleton } from "./_components/settings-skeleton"
import { SettingsForm } from "./_components/settings-form"

const _SettingsPage = Effect.fn("@blikka/web/SettingsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )

    return (
      <HydrateClient>
        <Suspense fallback={<SettingsSkeleton />}>
          <div className="mx-auto max-w-4xl px-6 py-4">
            <SettingsForm />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_SettingsPage)
