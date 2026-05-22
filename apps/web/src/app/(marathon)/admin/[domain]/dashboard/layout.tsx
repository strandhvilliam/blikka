import { Suspense } from 'react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { DashboardSidebar } from './_components/dashboard-sidebar'
import { DashboardHeader } from './_components/dashboard-header'
import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { PortalLayoutFallback } from '@/components/portal-layout-fallback'

export default function DashboardLayout(props: LayoutProps<'/admin/[domain]/dashboard'>) {
  return (
    <Suspense fallback={<PortalLayoutFallback />}>
      <DashboardLayoutContent {...props} />
    </Suspense>
  )
}

async function DashboardLayoutContent({
  children,
  params,
}: LayoutProps<'/admin/[domain]/dashboard'>) {
  const { domain } = await params
  prefetch(trpc.marathons.getUserMarathons.queryOptions())
  prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))
  return (
    <HydrateClient>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent max-h-screen">
          <div className="shrink-0">
            <DashboardHeader />
          </div>
          <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-tl-2xl border px-0 pt-8 pb-4 md:px-6 [&_h1.font-gothic]:font-medium [-webkit-overflow-scrolling:touch]">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </HydrateClient>
  )
}
