import { DomainProvider } from '@/lib/domain-provider'
import { requireDomainAccess } from '@/lib/auth/permissions'
import { formatDomainPathname } from '@/lib/utils'

export default async function DomainAdminLayout({
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
