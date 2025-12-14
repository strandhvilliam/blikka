import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { ClientPage } from "./client-page"

const _LivePage = Effect.fn("@blikka/web/LivePage")(
  function* ({ params }: PageProps<"/live/[domain]">) {
    return <ClientPage />
  }
  // Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_LivePage)
