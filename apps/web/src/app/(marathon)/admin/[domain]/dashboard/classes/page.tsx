import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { ClassesHeader } from "./_components/classes-header"
import { ClassesSkeleton } from "./_components/classes-skeleton"
import { CompetitionClassSection } from "./_components/competition-class-section"
import { DeviceGroupSection } from "./_components/device-group-section"
import { Separator } from "@/components/ui/separator"

const _ClassesPage = Effect.fn("@blikka/web/ClassesPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<ClassesSkeleton />}>
          <div className="container mx-auto p-6 space-y-10 max-w-[1300px]">
            <ClassesHeader />
            <Separator className="my-8" />
            <CompetitionClassSection />
            <Separator className="my-8" />
            <DeviceGroupSection />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_ClassesPage)
