import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCachedPublicGallery } from '@/lib/gallery-page-cache'
import { GalleryHeader } from './_components/gallery-header'
import { FeaturedSections } from './_components/featured-sections'
import { GalleryFeed } from './_components/gallery-feed'
import { TopicSelector } from './_components/topic-selector'
import { galleryHomeHref } from './_lib/href'
import type { PublicGallery } from './_lib/types'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>
}): Promise<Metadata> {
  const { domain } = await params
  try {
    const gallery = await getCachedPublicGallery(domain)
    return {
      title: `${gallery.marathon.name} — Gallery`,
      description: `Browse the published photo gallery for ${gallery.marathon.name}.`,
    }
  } catch {
    return { title: 'Gallery' }
  }
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  let gallery: PublicGallery
  try {
    gallery = await getCachedPublicGallery(domain)
  } catch {
    notFound()
  }

  const isByCamera = gallery.marathon.mode === 'by-camera'

  return (
    <main>
      <GalleryHeader
        marathon={gallery.marathon}
        homeHref={galleryHomeHref(domain)}
        subtitle={
          isByCamera
            ? 'Select a topic to browse its published gallery, or search for your submissions by reference number.'
            : 'Browse the full gallery or search for your submissions by reference number.'
        }
      />

      {isByCamera ? (
        <TopicSelector topics={gallery.topics} domain={domain} />
      ) : (
        <>
          <FeaturedSections sections={gallery.featuredSections} domain={domain} />
          <GalleryFeed
            domain={domain}
            topics={gallery.topics}
            competitionClasses={gallery.competitionClasses}
            priorityCount={gallery.featuredSections.length > 0 ? 0 : 10}
          />
        </>
      )}
    </main>
  )
}
