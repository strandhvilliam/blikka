import { DomainProvider } from "@/lib/domain-provider"
import { getAppSession } from "@/lib/auth/server"
import { formatDomainPathname } from "@/lib/utils"
import { getPermissions } from "@blikka/api/trpc/utils"
import { Option } from "effect"
import { redirect, RedirectType } from "next/navigation"
import { serverRuntime } from "@/lib/server-runtime"

export default async function StaffDomainLayout({
  children,
  params,
}: LayoutProps<"/staff/[domain]">) {
  const { domain } = await params
  const session = await serverRuntime.runPromise(getAppSession())
  const nextTarget = formatDomainPathname("/staff", domain, "staff")

  if (Option.isNone(session)) {
    redirect(`/auth/login?next=${encodeURIComponent(nextTarget)}`, RedirectType.replace)
  }

  const permissions = await serverRuntime.runPromise(getPermissions({ userId: session.value.user.id }))
  const permission = permissions.find((candidate) => candidate.domain === domain)

  if (!permission || (permission.role !== "staff" && permission.role !== "admin")) {
    redirect("/staff", RedirectType.replace)
  }

  return <DomainProvider domain={domain}>{children}</DomainProvider>}
