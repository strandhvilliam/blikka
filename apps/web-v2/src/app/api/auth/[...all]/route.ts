import { Auth } from "@/lib/auth/server"
import { Route } from "@/lib/next-utils"
import { Effect } from "effect"
import { NextRequest } from "next/server"

const _route = Effect.fn("@blikka/web/authRoute")(function* (req: NextRequest) {
  const auth = yield* Auth
  return yield* Effect.tryPromise(() => auth.handler(req)).pipe(
    Effect.catchAll(() => Effect.succeed(new Response("Internal Server Error", { status: 500 })))
  )
})

export const GET = Route(_route)
export const POST = Route(_route)
