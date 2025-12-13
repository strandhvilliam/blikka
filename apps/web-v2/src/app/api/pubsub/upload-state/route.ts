import { Route } from "@/lib/next-utils"
import { Effect, Stream } from "effect"
import { PubSubChannel, PubSubService } from "@blikka/pubsub"
import { NextRequest } from "next/server"

const _route = Effect.fn("@blikka/web/pubsub/uploadState")(
  function* ({ req }: { req: NextRequest }) {
    const pubsub = yield* PubSubService

    const searchParams = req.nextUrl.searchParams
    const rawChannel = searchParams.get("channel")

    if (!rawChannel) {
      return Response.json({ error: "Channel is required" }, { status: 400 })
    }

    const channel = yield* PubSubChannel.parse(rawChannel)

    const subscription = pubsub.subscribe(channel).pipe(
      Stream.map((data) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)),
      Stream.toReadableStream
    )

    return new Response(subscription, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  },
  Effect.catchTags({
    ChannelParseError: (error) =>
      Effect.succeed(Response.json({ error: error.message }, { status: 400 })),
  })
)

export const GET = (req: NextRequest) => Route(_route)({ req })
