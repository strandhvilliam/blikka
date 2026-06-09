'use server'

import { updateTag } from 'next/cache'
import { galleryHomeTag, galleryTopicTag } from './gallery-page-cache'

export async function revalidateGalleryPageCache({
  domain,
  topicOrderIndex,
}: {
  domain: string
  topicOrderIndex?: number | null
}) {
  updateTag(galleryHomeTag(domain))

  if (topicOrderIndex !== undefined && topicOrderIndex !== null) {
    updateTag(galleryTopicTag(domain, topicOrderIndex))
  }
}
