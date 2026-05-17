import { getAppSession } from "@/lib/auth/server"

import { redirect, RedirectType } from "next/navigation"

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const session = await getAppSession()

  if (!session) {
    console.log("redirecting to login")
    redirect("/auth/login", RedirectType.replace)
  }
  return <>{children}</>
}
