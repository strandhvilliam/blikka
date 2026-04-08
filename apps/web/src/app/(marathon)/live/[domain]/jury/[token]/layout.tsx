import { decodeParams, Layout } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { JuryClientTokenProvider } from "@/components/live/jury/jury-client-token-provider"

const _JuryTokenLayout = Effect.fn("@blikka/web/JuryTokenLayout")(
  function* ({ children, params }: LayoutProps<"/live/[domain]/jury/[token]">) {
    const { token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params)
    return (
      <JuryClientTokenProvider token={token}>{children}</JuryClientTokenProvider>
    )
  },
  Effect.catch((error) =>
    Effect.succeed(
      <div>
        Error: {error instanceof Error ? error.message : String(error)}
      </div>,
    ),
  ),
)

export default Layout(_JuryTokenLayout)
