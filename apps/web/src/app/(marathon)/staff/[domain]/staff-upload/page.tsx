import { getAppSession } from '@/lib/auth/server'
import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StaffLaptopUploadClient } from '@/components/staff/staff-laptop-upload-client'

export default async function StaffLaptopUploadPage({
  params,
}: PageProps<'/staff/[domain]/staff-upload'>) {
  const { domain } = await params
  const session = await getAppSession()

  if (!session) {
    return <div />
  }

  prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))

  return (
    <HydrateClient>
      <Suspense
        fallback={
          <div className="relative min-h-screen">
            <div className="border-b border-border bg-background/80 backdrop-blur-lg">
              <div className="mx-auto grid max-w-3xl grid-cols-[auto_1fr_auto] items-center gap-3 px-6 py-4">
                <Skeleton className="h-8 w-20 rounded-full" />
                <div className="flex justify-center">
                  <Skeleton className="h-7 w-48 rounded-full" />
                </div>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="hidden h-4 w-28 sm:block" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
              </div>
            </div>
            <div className="mx-auto max-w-3xl px-6 py-16">
              <div className="flex flex-col items-center space-y-4">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="mt-6 h-16 w-72 rounded-2xl" />
              </div>
            </div>
          </div>
        }
      >
        <StaffLaptopUploadClient
          staffName={session.user.name ?? session.user.email}
          staffEmail={session.user.email}
          staffImage={session.user.image ?? null}
        />
      </Suspense>
    </HydrateClient>
  )
}
