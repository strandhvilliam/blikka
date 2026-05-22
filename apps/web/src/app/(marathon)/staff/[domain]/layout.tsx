import { Suspense } from 'react'
import { DomainProvider } from '@/lib/domain-provider'
import { requireDomainAccess } from '@/lib/auth/permissions'
import { formatDomainPathname } from '@/lib/utils'
import { PortalLayoutFallback } from '@/components/portal-layout-fallback'

export default function StaffDomainLayout(props: LayoutProps<'/staff/[domain]'>) {
  return (
    <Suspense fallback={<PortalLayoutFallback />}>
      <StaffDomainLayoutContent {...props} />
    </Suspense>
  )
}

async function StaffDomainLayoutContent({
  children,
  params,
}: LayoutProps<'/staff/[domain]'>) {
  const { domain } = await params
  await requireDomainAccess({
    domain,
    roles: ['admin', 'staff'],
    next: formatDomainPathname('/staff', domain, 'staff'),
    portal: 'staff',
  })

  return <DomainProvider domain={domain}>{children}</DomainProvider>
}
