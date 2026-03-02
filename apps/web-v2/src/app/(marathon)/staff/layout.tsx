import { getAppSession } from "@/lib/auth/server"
import { Layout } from "@/lib/next-utils"
import { Effect, Option } from "effect"
import { redirect, RedirectType } from "next/navigation"

const _StaffLayout = Effect.fn("@blikka/web/StaffLayout")(function* ({
  children,
}: LayoutProps<"/staff">) {
  const session = yield* getAppSession()

  if (Option.isNone(session)) {
    redirect("/auth/login?next=/staff", RedirectType.replace)
  }

  return <>{children}</>
})

export default Layout(_StaffLayout)
