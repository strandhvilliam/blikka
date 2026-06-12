import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SectionHeading } from './gallery-chrome'
import { galleryTopicHref } from '../_lib/href'
import type { GalleryTopicMeta } from '../_lib/types'

export function TopicSelector({ topics, domain }: { topics: GalleryTopicMeta[]; domain: string }) {
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
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <SectionHeading title="Topics" meta={`${topics.length} published`} />

      {/* Numbered index — reads like gallery wall text rather than a list of buttons. */}
      <ul className="border-t border-white/10">
        {topics.map((topic) => {
          const number = String(topic.orderIndex + 1).padStart(2, '0')
          const title = topic.name.replace(/^\d+\.\s*/, '')
          return (
            <li key={topic.id}>
              <Link
                href={galleryTopicHref(domain, topic.orderIndex)}
                className="group flex items-center gap-5 border-b border-white/10 py-6 outline-none transition-colors hover:bg-white/[0.02] focus-visible:bg-white/[0.04] sm:gap-7 sm:py-7"
              >
                <span className="w-9 shrink-0 font-mono text-sm tabular-nums text-neutral-600 transition-colors group-hover:text-neutral-300">
                  {number}
                </span>
                <span className="min-w-0 flex-1 truncate font-gothic text-2xl font-normal tracking-tight text-neutral-300 transition-colors group-hover:text-white sm:text-4xl">
                  {title}
                </span>
                <ArrowUpRight className="size-5 shrink-0 -translate-x-1 text-neutral-600 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-white group-hover:opacity-100" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
