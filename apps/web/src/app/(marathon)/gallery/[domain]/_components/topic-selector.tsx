import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { galleryTopicHref } from '../_lib/href'
import type { GalleryTopicMeta } from '../_lib/types'

export function TopicSelector({
  topics,
  domain,
}: {
  topics: GalleryTopicMeta[]
  domain: string
}) {
  if (topics.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <p className="text-center text-sm text-neutral-500">
          No topic galleries have been published yet.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <h2 className="font-special-gothic text-lg tracking-tight text-white sm:text-xl">
          Topic galleries
        </h2>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            href={galleryTopicHref(domain, topic.orderIndex)}
            className="group flex min-h-16 touch-manipulation items-center justify-between gap-4 rounded-md border border-white/10 bg-neutral-950 px-5 py-5 transition-colors hover:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-lg text-white">{topic.name}</span>
            </div>
            <ArrowUpRight className="size-5 shrink-0 text-neutral-600 transition-colors group-hover:text-white" />
          </Link>
        ))}
      </div>
    </div>
  )
}
