import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getCachedByCameraTopicGallery } from '@/lib/gallery-page-cache'
import { GalleryHeader } from '../_components/gallery-header'
import { FeaturedSections } from '../_components/featured-sections'
import { GalleryFeed } from '../_components/gallery-feed'
import { BackLink } from '../_components/gallery-chrome'
import { galleryHomeHref, galleryTopicHref } from '../_lib/href'
import type { ByCameraTopicGallery } from '../_lib/types'

function parseOrderIndex(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; topicOrderIndex: string }>
}): Promise<Metadata> {
  const { domain, topicOrderIndex } = await params
  const orderIndex = parseOrderIndex(topicOrderIndex)
  if (orderIndex === null) return { title: 'Gallery' }
  try {
    const gallery = await getCachedByCameraTopicGallery(domain, orderIndex)
    return {
      title: `${gallery.topic.name} — ${gallery.marathon.name} Gallery`,
      description: `Browse published photos for ${gallery.topic.name}.`,
    }
  } catch {
    return { title: 'Gallery' }
  }
}

export default async function ByCameraTopicGalleryPage({
  params,
}: {
  params: Promise<{ domain: string; topicOrderIndex: string }>
}) {
  const { domain, topicOrderIndex } = await params
  const orderIndex = parseOrderIndex(topicOrderIndex)
  if (orderIndex === null) notFound()

  let gallery: ByCameraTopicGallery
  try {
    gallery = await getCachedByCameraTopicGallery(domain, orderIndex)
  } catch {
    notFound()
  }

  return (
    <main>
      <GalleryHeader
        marathon={gallery.marathon}
        homeHref={galleryHomeHref(domain)}
        subtitle={gallery.topic.name}
      />

      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <BackLink href={galleryHomeHref(domain)} label="All topics" />

        {gallery.publishedTopics.length > 1 ? (
          <nav className="mt-4" aria-label="Topic galleries">
            <div className="-mx-4 flex snap-x items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
              {gallery.publishedTopics.map((topic) => (
                <Link
                  key={topic.id}
                  href={galleryTopicHref(domain, topic.orderIndex)}
                  aria-current={topic.orderIndex === gallery.topic.orderIndex ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-10 shrink-0 snap-start touch-manipulation items-center whitespace-nowrap rounded-full border px-4 py-2 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                    topic.orderIndex === gallery.topic.orderIndex
                      ? 'border-brand-primary bg-brand-primary text-brand-white'
                      : 'border-white/15 text-neutral-300 hover:border-white/40 hover:text-white',
                  )}
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </div>

      <FeaturedSections sections={gallery.featuredSections} domain={domain} />
      <GalleryFeed
        domain={domain}
        topics={[]}
        competitionClasses={[]}
        fixedTopicOrderIndex={orderIndex}
        showFilters={false}
        priorityCount={gallery.featuredSections.length > 0 ? 0 : 10}
      />
    </main>
  )
}
