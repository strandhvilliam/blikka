import { SidebarProvider } from "@/components/ui/sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Effect, Schema } from "effect"
import { decodeParams, Layout } from "@/lib/next-utils"
import { DashboardSidebar } from "./_components/dashboard-sidebar"
import { DashboardHeader } from "./_components/dashboard-header"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"

const _DashboardLayout = Effect.fn("@blikka/web/DashboardLayout")(
  function* ({ children, params }: LayoutProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    prefetch(trpc.marathons.getUserMarathons.queryOptions())
    prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))
    return (
      <HydrateClient>
        <SidebarProvider>
          <DashboardSidebar />
          <SidebarInset className="bg-transparent flex flex-1 flex-col max-h-screen overflow-hidden relative">
            <DashboardHeader />
            <div className="border rounded-tl-2xl overflow-y-auto h-full overflow-hidden relative z-0 px-6 pt-8 pb-4 [&_h1.font-gothic]:font-medium">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Layout(_DashboardLayout)
