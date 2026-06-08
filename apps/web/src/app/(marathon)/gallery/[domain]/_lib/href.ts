/**
 * Internal Next.js paths for gallery navigation.
 *
 * In production the gallery is served from the marathon subdomain, so paths are
 * relative to `/gallery`. In development the domain is encoded in the path
 * (`/gallery/{domain}/...`) since there is no subdomain.
 */
const isProduction = process.env.NODE_ENV === 'production'

export function galleryHomeHref(domain: string): string {
  return isProduction ? '/gallery' : `/gallery/${domain}`
}

export function galleryTopicHref(domain: string, orderIndex: number): string {
  return isProduction ? `/gallery/${orderIndex}` : `/gallery/${domain}/${orderIndex}`
}

export function galleryParticipantHref(domain: string, reference: string): string {
  const encoded = encodeURIComponent(reference)
  return isProduction ? `/gallery/participants/${encoded}` : `/gallery/${domain}/participants/${encoded}`
}
