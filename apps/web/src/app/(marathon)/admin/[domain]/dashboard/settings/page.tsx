import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { SettingsSkeleton } from "./_components/settings-skeleton"
import { SettingsForm } from "./_components/settings-form"

export default async function SettingsPage({ params }: PageProps<"/admin/[domain]/dashboard">) {
  const { domain } = await params

  prefetch(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  return (
    <HydrateClient>
      <Suspense fallback={<SettingsSkeleton />}>
        <div className="mx-auto w-full max-w-4xl px-6 py-4">
          <SettingsForm />
        </div>
      </Suspense>
    </HydrateClient>
  )
}
