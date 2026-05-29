'use server'

import { updateTag } from 'next/cache'
import { termsMarkdownTag, termsMarathonMetaTag } from '@/lib/terms-page-cache'

export async function revalidateTermsPageCache(domain: string) {
  updateTag(termsMarkdownTag(domain))
  updateTag(termsMarathonMetaTag(domain))
}

export async function revalidateTermsMarathonMetaCache(domain: string) {
  updateTag(termsMarathonMetaTag(domain))
}
