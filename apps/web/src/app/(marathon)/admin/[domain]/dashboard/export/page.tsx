import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { fetchEffectQuery, HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { ExportContent } from "./_components/export-content"
import { ExportSkeleton } from "./_components/export-skeleton"

const _ExportPage = Effect.fn("@blikka/web/ExportPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    const marathon = yield* fetchEffectQuery(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )

    if (marathon.mode !== "by-camera") {
      prefetch(trpc.zipFiles.getZipSubmissionStatus.queryOptions({ domain }))
      prefetch(trpc.zipFiles.getZipDownloadProgress.queryOptions({ domain, processId: "" }))
    }

    return (
      <HydrateClient>
        <Suspense fallback={<ExportSkeleton />}>
          <div className="mx-auto w-full max-w-4xl px-6 py-4">
            <ExportContent />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_ExportPage)
