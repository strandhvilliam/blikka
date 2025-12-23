import { Route } from "@/lib/next-utils"
import { Data, Effect, Schema, Stream } from "effect"
import { PubSubChannel, PubSubService } from "@blikka/pubsub"
import { NextRequest } from "next/server"

class ValidateParticipantReferenceError extends Data.TaggedError(
  "ValidateParticipantReferenceError"
)<{
  message?: string
  cause?: unknown
}> {}

const environment = process.env.NODE_ENV === "production" ? "prod" : "dev"

const ParticipantReferenceSchema = Schema.String.pipe(
  Schema.length(4),
  Schema.pattern(/^[0-9a-zA-Z]+$/)
)

const validateParticipantReference = Effect.fnUntraced(function* (
  participantReference: string | null
) {
  if (!participantReference) {
    return yield* Effect.fail(
      new ValidateParticipantReferenceError({ message: "Participant reference is required" })
    )
  }
  return yield* Schema.decode(ParticipantReferenceSchema)(participantReference).pipe(
    Effect.mapError((error) => new ValidateParticipantReferenceError({ message: error.message }))
  )
})

const _route = Effect.fn("@blikka/web/pubsub/uploadState")(
  function* ({ req }: { req: NextRequest }) {
    const pubsub = yield* PubSubService

    const searchParams = req.nextUrl.searchParams
    const referenceParam = searchParams.get("participantReference")
    const domainParam = searchParams.get("domain")
    const participantReference = yield* validateParticipantReference(referenceParam)

    if (!domainParam) {
      return yield* Effect.succeed(Response.json({ error: "Domain is required" }, { status: 400 }))
    }

    const channel = yield* PubSubChannel.fromString(
      `${environment}:upload-flow:${domainParam}-${participantReference}`
    )

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
    ValidateParticipantReferenceError: (error) =>
      Effect.succeed(Response.json({ error: error.message }, { status: 400 })),
  })
)

export const GET = (req: NextRequest) => Route(_route)({ req })
