import { SidebarProvider } from "@/components/ui/sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { Effect } from "effect"
import { Layout } from "@/lib/next-utils"

const _DashboardLayout = Effect.fn("@blikka/web/DashboardLayout")(function* ({
  children,
}: LayoutProps<"/admin/[domain]/dashboard">) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className=" flex flex-1 flex-col max-h-screen overflow-hidden relative">
        <AppHeader />
        <div className="border rounded-tl-2xl overflow-y-auto h-full overflow-hidden relative z-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
})

export default Layout(_DashboardLayout)
