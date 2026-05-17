import { getAppSession } from "@/lib/auth/server"
import { serverRuntime } from "@/lib/server-runtime"

import { Option } from "effect"
import { redirect, RedirectType } from "next/navigation"

export default async function StaffLayout({
  children,
}: LayoutProps<"/staff">) {
  const session = await serverRuntime.runPromise(getAppSession())

  if (Option.isNone(session)) {
    redirect("/auth/login?next=/staff", RedirectType.replace)
  }

  return <>{children}</>
}
