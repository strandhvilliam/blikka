import { decodeParams } from "@/lib/next-utils"
import { Suspense } from "react"
import { Effect, Schema } from "effect"
import { HydrateClient } from "@/lib/trpc/server"
import { FlowClientPage } from "./_components/flow-client-page"
import { Page } from "@/lib/next-utils"

const _FlowPage = Effect.fn("@blikka/web/FlowPage")(
    function* ({ params }: PageProps<"/live/[domain]">) {
        const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
        return (
            <HydrateClient>
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div>Loading...</div></div>}>
                </Suspense>
            </HydrateClient>
        )
    },
    Effect.catchAll((error) =>
        Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>)
    )
)

export default Page(_FlowPage)
