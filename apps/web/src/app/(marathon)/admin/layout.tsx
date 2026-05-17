import { getAppSession } from "@/lib/auth/server"
import { serverRuntime } from "@/lib/server-runtime"

import { Option } from "effect"
import { redirect, RedirectType } from "next/navigation"

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const session = await serverRuntime.runPromise(getAppSession())

  if (Option.isNone(session)) {
    console.log("redirecting to login")
    redirect("/auth/login", RedirectType.replace)
  }
  return <>{children}</>
}
