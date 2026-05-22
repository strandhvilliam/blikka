import { Suspense } from 'react'
import { DomainProvider } from '@/lib/domain-provider'
import { Splash } from '@/components/splash'

export default function DomainLiveLayout(props: LayoutProps<'/live/[domain]'>) {
  return (
    <Suspense fallback={<Splash />}>
      <DomainLiveLayoutContent {...props} />
    </Suspense>
  )
}

async function DomainLiveLayoutContent({
  children,
  params,
}: LayoutProps<'/live/[domain]'>) {
  const { domain } = await params
  return <DomainProvider domain={domain}>{children}</DomainProvider>
}
