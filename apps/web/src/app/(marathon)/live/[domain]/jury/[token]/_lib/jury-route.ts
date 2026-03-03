import "server-only"

import { notFound, redirect } from "next/navigation"
import { Effect } from "effect"
import { fetchEffectQuery, trpc } from "@/lib/trpc/server"
import { getJuryUnavailablePath } from "./jury-paths"

export const getJuryInvitationForRoute = Effect.fn("@blikka/web/getJuryInvitationForRoute")(
  function* ({ domain, token }: { domain: string; token: string }) {
    return yield* fetchEffectQuery(
      trpc.jury.verifyTokenAndGetInitialData.queryOptions({ domain, token }),
    ).pipe(
      Effect.catchAll((error) => {
        if (error.message.includes("Invitation expired")) {
          return Effect.fail(redirect(getJuryUnavailablePath(domain, token, "expired")))
        }

        if (error.message.includes("Unsupported marathon mode")) {
          return Effect.fail(
            redirect(getJuryUnavailablePath(domain, token, "unsupported-mode")),
          )
        }

        return Effect.fail(notFound())
      }),
    )
  },
)
