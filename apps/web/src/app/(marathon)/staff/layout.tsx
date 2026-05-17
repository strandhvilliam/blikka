import { getAppSession } from '@/lib/auth/server'

import { redirect, RedirectType } from 'next/navigation'

export default async function StaffLayout({ children }: LayoutProps<'/staff'>) {
  const session = await getAppSession()

  if (!session) {
    redirect('/auth/login?next=/staff', RedirectType.replace)
  }

  return <>{children}</>
}
