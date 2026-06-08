import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { fetchServerQuery, trpc } from '@/lib/trpc/server'
import { GalleryHeader } from '../../_components/gallery-header'
import { ParticipantSet } from '../../_components/participant-set'
import { galleryHomeHref } from '../../_lib/href'
import type { GalleryParticipantSetResult, PublicGallery } from '../../_lib/types'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; reference: string }>
}): Promise<Metadata> {
  const { reference } = await params
  return {
    title: `#${reference} — Gallery`,
    // Shareable but kept out of search indexes to limit exposure of reference pages.
    robots: { index: false, follow: false },
  }
}

export default async function ParticipantSetPage({
  params,
}: {
  params: Promise<{ domain: string; reference: string }>
}) {
  const { domain, reference } = await params

  let gallery: PublicGallery
  let participantSet: GalleryParticipantSetResult
  try {
    ;[gallery, participantSet] = await Promise.all([
      fetchServerQuery(trpc.gallery.getPublicGallery.queryOptions({ domain })),
      fetchServerQuery(
        trpc.gallery.getGalleryParticipantSet.queryOptions({ domain, reference }),
      ),
    ])
  } catch {
    notFound()
  }

  return (
    <main>
      <GalleryHeader marathon={gallery.marathon} homeHref={galleryHomeHref(domain)} />

      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <Link
          href={galleryHomeHref(domain)}
          className="inline-flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-white"
        >
          <ChevronLeft className="size-4" /> Back to gallery
        </Link>
      </div>

      <ParticipantSet participantSet={participantSet} />
    </main>
  )
}
