import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"

const _LivePage = Effect.fn("@blikka/web/LivePage")(
  function* ({ params }: PageProps<"/live/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    return <div>Live {domain}</div>
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_LivePage)
