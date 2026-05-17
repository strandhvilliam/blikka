import { redirect } from 'next/navigation'
import { formatDomainPathname } from '@/lib/utils'

export default async function JuryInvitationLegacyRedirectPage({
  params,
}: PageProps<'/admin/[domain]/dashboard/jury/[invitationId]'>) {
  const { domain, invitationId } = await params

  const parsedId = parseInt(invitationId, 10)
  const basePath = formatDomainPathname('/admin/dashboard/jury', domain)
  if (Number.isNaN(parsedId)) {
    return redirect(basePath)
  }

  return redirect(`${basePath}?invitation=${parsedId}`)
}
