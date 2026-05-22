import { Suspense } from 'react'
import { getAppSession } from '@/lib/auth/server'
import { redirect, RedirectType } from 'next/navigation'
import { PortalLayoutFallback } from '@/components/portal-layout-fallback'

export default function StaffLayout(props: LayoutProps<'/staff'>) {
  return (
    <Suspense fallback={<PortalLayoutFallback />}>
      <StaffLayoutContent {...props} />
    </Suspense>
  )
}

async function StaffLayoutContent({ children }: LayoutProps<'/staff'>) {
  const session = await getAppSession()

  if (!session) {
    redirect('/auth/login?next=/staff', RedirectType.replace)
  }

  return <>{children}</>
}
