import { Effect } from "effect"
import { authProcedure, createTRPCRouter } from "../root"
import { trpcEffect } from "../utils"
import { Database } from "@blikka/db"

export const marathonRouter = createTRPCRouter({
  getUserMarathons: authProcedure.query(
    trpcEffect(
      Effect.fn("MarathonRouter.getUserMarathons")(function* ({ ctx }) {
        const db = yield* Database
        return yield* db.usersQueries.getMarathonsByUserId({ userId: ctx.session.user.id })
      })
    )
  ),
})
