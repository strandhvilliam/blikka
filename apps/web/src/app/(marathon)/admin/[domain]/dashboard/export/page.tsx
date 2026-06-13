import { fetchServerQuery, HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { Suspense } from 'react'
import { ExportContent } from './_components/export-content'
import { ExportSkeleton } from './_components/export-skeleton'

export default async function ExportPage({ params }: PageProps<'/admin/[domain]/dashboard'>) {
  const { domain } = await params

  const marathon = await fetchServerQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  if (marathon.mode !== 'by-camera') {
    // Warm both the live file list (active export, if any) and the pre-flight preview (when idle).
    prefetch(trpc.zipFiles.getExportFiles.queryOptions({ domain }))
    prefetch(trpc.zipFiles.getExportPreview.queryOptions({ domain }))
  }

  return (
    <HydrateClient>
      <Suspense fallback={<ExportSkeleton />}>
        <div className="mx-auto w-full max-w-4xl px-6 py-4">
          <ExportContent />
        </div>
      </Suspense>
    </HydrateClient>
  )
}
