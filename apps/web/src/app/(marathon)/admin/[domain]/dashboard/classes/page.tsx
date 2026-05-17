import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { ClassesHeader } from "./_components/classes-header"
import { ClassesSkeleton } from "./_components/classes-skeleton"
import { CompetitionClassSection } from "./_components/competition-class-section"
import { DeviceGroupSection } from "./_components/device-group-section"

export default async function ClassesPage({ params }: PageProps<"/admin/[domain]/dashboard">) {
  const { domain } = await params

  prefetch(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  return (
    <HydrateClient>
      <Suspense fallback={<ClassesSkeleton />}>
        <div className="mx-auto w-full max-w-4xl px-6 py-4">
          <ClassesHeader />
          <div className="space-y-10">
            <CompetitionClassSection />
            <DeviceGroupSection />
          </div>
        </div>
      </Suspense>
    </HydrateClient>
  )
}
