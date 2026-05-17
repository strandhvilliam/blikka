import { redirect } from 'next/navigation'
import { formatDomainPathname } from '@/lib/utils'

export default async function StaffAccessLegacyRedirectPage({
  params,
}: PageProps<'/admin/[domain]/dashboard/staff/[accessId]'>) {
  const { domain, accessId } = await params

  const basePath = formatDomainPathname('/admin/dashboard/staff', domain)
  return redirect(`${basePath}?access=${encodeURIComponent(accessId)}`)
}
