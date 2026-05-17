import { DomainProvider } from '@/lib/domain-provider'
import { requireDomainAccess } from '@/lib/auth/permissions'
import { formatDomainPathname } from '@/lib/utils'

export default async function StaffDomainLayout({
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
