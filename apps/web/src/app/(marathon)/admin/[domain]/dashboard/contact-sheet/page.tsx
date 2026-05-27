import { fetchServerQuery, HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ContactSheetEditor } from './_components/contact-sheet-editor'
import { ContactSheetEditorSkeleton } from './_components/contact-sheet-editor-skeleton'
import { ContactSheetRunSettings } from './_components/contact-sheet-run-settings'

export default async function ContactSheetPage({
  params,
}: PageProps<'/admin/[domain]/dashboard'>) {
  const { domain } = await params

  const marathon = await fetchServerQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  if (marathon.mode !== 'marathon') {
    notFound()
  }

  prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))
  prefetch(trpc.sponsors.getByMarathon.queryOptions({ domain }))

  return (
    <HydrateClient>
      <Suspense fallback={<ContactSheetEditorSkeleton />}>
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <ContactSheetEditor />
          <ContactSheetRunSettings />
        </div>
      </Suspense>
    </HydrateClient>
  )
}
