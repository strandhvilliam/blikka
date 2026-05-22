import { Suspense } from 'react'
import { DomainProvider } from '@/lib/domain-provider'
import { requireDomainAccess } from '@/lib/auth/permissions'
import { formatDomainPathname } from '@/lib/utils'
import { PortalLayoutFallback } from '@/components/portal-layout-fallback'

export default function DomainAdminLayout(props: LayoutProps<'/admin/[domain]'>) {
  return (
    <Suspense fallback={<PortalLayoutFallback />}>
      <DomainAdminLayoutContent {...props} />
    </Suspense>
  )
}

async function DomainAdminLayoutContent({
  children,
  params,
}: LayoutProps<'/admin/[domain]'>) {
  const { domain } = await params
  await requireDomainAccess({
    domain,
    roles: ['admin'],
    next: formatDomainPathname('/admin/dashboard', domain, 'admin'),
    portal: 'admin',
  })

  return <DomainProvider domain={domain}>{children}</DomainProvider>
}
