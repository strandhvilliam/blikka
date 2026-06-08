import { Suspense } from 'react'
import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { GalleryAdminContent } from './_components/gallery-admin-content'
import { GalleryAdminSkeleton } from './_components/gallery-admin-skeleton'

export default async function GalleryAdminPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))
  prefetch(trpc.gallery.getGalleryAdminState.queryOptions({ domain }))

  return (
    <HydrateClient>
      <Suspense fallback={<GalleryAdminSkeleton />}>
        <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-3 pb-10 sm:px-6 sm:py-4">
          <GalleryAdminContent />
        </div>
      </Suspense>
    </HydrateClient>
  )
}
