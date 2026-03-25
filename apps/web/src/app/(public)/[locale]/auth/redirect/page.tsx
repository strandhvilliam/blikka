import { getAppSession } from "@/lib/auth/server"
import { getDefaultPostLoginPath } from "@/lib/auth/redirect"
import { Page } from "@/lib/next-utils"
import { getPermissions } from "@blikka/api/trpc/utils"
import { Effect, Option } from "effect"
import { redirect } from "next/navigation"

const _AuthRedirectPage = Effect.fn("@blikka/web/AuthRedirectPage")(function* () {
  const session = yield* getAppSession()

  if (Option.isNone(session)) {
    redirect("/auth/login")
  }

  const permissions = yield* getPermissions({ userId: session.value.user.id })

  redirect(getDefaultPostLoginPath(permissions))
})

export default Page(_AuthRedirectPage)
