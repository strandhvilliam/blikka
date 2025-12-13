import { Metadata } from "next"
import { Effect } from "effect"
import { Layout } from "@/lib/next-utils"
import { getAppSession } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Blikka App",
}

const _DomainLayout = Effect.fn("@blikka/web/DomainLayout")(function* ({
  children,
}: LayoutProps<"/admin/[domain]">) {
  const session = yield* getAppSession()

  return <pre>{JSON.stringify(session, null, 2)}</pre>
})

export default Layout(_DomainLayout)
