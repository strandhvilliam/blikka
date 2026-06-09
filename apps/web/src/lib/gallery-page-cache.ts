import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { appRouter, createCallerFactory } from '@blikka/api/trpc'
import { serverRuntime } from './server-runtime'

const GALLERY_PAGE_REVALIDATE_SECONDS = 300

const createCaller = createCallerFactory(appRouter)

export function galleryHomeTag(domain: string): string {
  return `gallery-home:${domain}`
}

export function galleryTopicTag(domain: string, topicOrderIndex: number): string {
  return `gallery-topic:${domain}:${topicOrderIndex}`
}

function getPublicCaller() {
  return createCaller({
    runtime: serverRuntime,
    session: null,
    permissions: [],
    domain: null,
  })
}

async function loadPublicGallery(domain: string) {
  const caller = getPublicCaller()
  return caller.gallery.getPublicGallery({ domain })
}

async function loadByCameraTopicGallery(domain: string, topicOrderIndex: number) {
  const caller = getPublicCaller()
  return caller.gallery.getByCameraTopicGallery({ domain, topicOrderIndex })
}

export const getCachedPublicGallery = cache(async (domain: string) => {
  return unstable_cache(() => loadPublicGallery(domain), ['gallery-home', domain], {
    revalidate: GALLERY_PAGE_REVALIDATE_SECONDS,
    tags: [galleryHomeTag(domain)],
  })()
})

export const getCachedByCameraTopicGallery = cache(
  async (domain: string, topicOrderIndex: number) => {
    return unstable_cache(
      () => loadByCameraTopicGallery(domain, topicOrderIndex),
      ['gallery-topic', domain, topicOrderIndex.toString()],
      {
        revalidate: GALLERY_PAGE_REVALIDATE_SECONDS,
        tags: [galleryHomeTag(domain), galleryTopicTag(domain, topicOrderIndex)],
      },
    )()
  },
)
