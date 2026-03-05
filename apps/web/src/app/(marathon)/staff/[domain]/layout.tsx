import { DomainProvider } from "@/lib/domain-provider"
import { getAppSession } from "@/lib/auth/server"
import { decodeParams, Layout } from "@/lib/next-utils"
import { formatDomainPathname } from "@/lib/utils"
import { getPermissions } from "@blikka/api/trpc/utils"
import { Effect, Option, Schema } from "effect"
import { redirect, RedirectType } from "next/navigation"

const _StaffDomainLayout = Effect.fn("@blikka/web/StaffDomainLayout")(
  function* ({ children, params }: LayoutProps<"/staff/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const session = yield* getAppSession()
    const nextTarget = formatDomainPathname("/staff", domain, "staff")

    if (Option.isNone(session)) {
      redirect(`/auth/login?next=${encodeURIComponent(nextTarget)}`, RedirectType.replace)
    }

    const permissions = yield* getPermissions({ userId: session.value.user.id })
    const permission = permissions.find((candidate) => candidate.domain === domain)

    if (!permission || (permission.role !== "staff" && permission.role !== "admin")) {
      redirect("/staff", RedirectType.replace)
    }

    return <DomainProvider domain={domain}>{children}</DomainProvider>
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Layout(_StaffDomainLayout)
