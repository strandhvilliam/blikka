import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { formatDomainPathname } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Blikka App',
}

export default async function DomainPage({ params }: PageProps<'/admin/[domain]'>) {
  const { domain } = await params

  //TODO: Replace with check if marathon is onboarded and configured
  const isOnboarded = true

  if (!isOnboarded) {
    return redirect(formatDomainPathname(`/admin/onboarding`, domain))
  }

  return redirect(formatDomainPathname(`/admin/dashboard`, domain))
}
