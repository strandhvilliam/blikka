import { Suspense } from 'react'
import { getAppSession } from '@/lib/auth/server'
import { redirect, RedirectType } from 'next/navigation'
import { PortalLayoutFallback } from '@/components/portal-layout-fallback'

export default function AdminLayout(props: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<PortalLayoutFallback />}>
      <AdminLayoutContent {...props} />
    </Suspense>
  )
}

async function AdminLayoutContent({ children }: LayoutProps<'/admin'>) {
  const session = await getAppSession()

  if (!session) {
    redirect('/auth/login?next=/admin', RedirectType.replace)
  }

  return <>{children}</>
}
