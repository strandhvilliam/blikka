import { Route } from "@/lib/next-utils"
import { Effect, Option, Schema, Stream } from "effect"
import { PubSubChannel, PubSubService, RunStateEventSchema } from "@blikka/pubsub"
import { NextRequest } from "next/server"

const environment = process.env.NODE_ENV === "production" ? "prod" : "dev"

const _route = Effect.fn("@blikka/web/pubsub/participantEvents")(
  function* ({ req }: { req: NextRequest }) {
    const pubsub = yield* PubSubService

    const searchParams = req.nextUrl.searchParams
    const domainParam = searchParams.get("domain")

    if (!domainParam) {
      return yield* Effect.succeed(Response.json({ error: "Domain is required" }, { status: 400 }))
    }

    const channel = yield* PubSubChannel.fromString(`${environment}:upload-flow:*`)

    const allowedTaskNames = [
      "upload-initializer",
      "upload-finalizer",
      "zip-worker",
      "validation-runner",
      "contact-sheet-generator",
    ]

    const subscription = pubsub.subscribe(channel).pipe(
      Stream.filterEffect((data) =>
        Effect.gen(function* () {
          const payload = Schema.decodeUnknownOption(RunStateEventSchema)(data.payload)

          if (Option.isNone(payload)) {
            return false
          }
          return allowedTaskNames.includes(payload.value.taskName)
        })
      ),
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
