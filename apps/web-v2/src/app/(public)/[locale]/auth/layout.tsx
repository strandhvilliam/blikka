import { getAppSession } from "@/lib/auth/server"
import { Layout } from "@/lib/next-utils"
import { Effect, Option } from "effect"
import { redirect } from "next/navigation"

const _AuthLayout = Effect.fn("@blikka/web/AuthLayout")(function* ({
  children,
}: LayoutProps<"/[locale]/auth">) {
  const session = yield* getAppSession()
  if (Option.isSome(session)) {
    redirect("/admin/")
  }

  return <>{children}</>
})

export default Layout(_AuthLayout)
