import { getAppSession } from "@/lib/auth/server"
import { Layout } from "@/lib/next-utils"
import { Option, Effect } from "effect"
import { redirect, RedirectType } from "next/navigation"

const _AdminLayout = Effect.fn("@blikka/web/AdminLayout")(function* ({
  children,
}: LayoutProps<"/admin">) {
  const session = yield* getAppSession()

  if (Option.isNone(session)) {
    console.log("redirecting to login")
    redirect("/auth/login", RedirectType.replace)
  }
  return <>{children}</>
})

export default Layout(_AdminLayout)
