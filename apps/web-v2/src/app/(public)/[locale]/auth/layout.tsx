import { Layout } from "@/lib/next-utils"
import { Effect } from "effect"

const _AuthLayout = Effect.fn("@blikka/web/AuthLayout")(function* ({
  children,
}: LayoutProps<"/[locale]/auth">) {
  return <>{children}</>
})

export default Layout(_AuthLayout)
