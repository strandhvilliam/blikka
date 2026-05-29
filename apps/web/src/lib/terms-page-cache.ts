import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { Config, Effect, Exit, Option } from 'effect'
import { DbLayer, MarathonsRepository } from '@blikka/db'
import { buildS3Url } from '@/lib/utils'

export type TermsPageMarathonMeta = {
  name: string
  logoUrl: string | null | undefined
}

/** Fallback TTL when tags are not revalidated (terms change rarely). */
const TERMS_MARKDOWN_REVALIDATE_SECONDS = 86_400

/** Fallback TTL for marathon name/logo on the public terms page. */
const TERMS_MARATHON_META_REVALIDATE_SECONDS = 3_600

export function termsMarkdownTag(domain: string) {
  return `terms-markdown:${domain}`
}

export function termsMarathonMetaTag(domain: string) {
  return `terms-marathon-meta:${domain}`
}

async function loadTermsMarkdown(domain: string): Promise<string | null> {
  const result = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const bucket = yield* Config.string('NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME')
      if (!bucket) return yield* Effect.fail(new Error('Bucket not found'))

      const key = `${domain}/terms-and-conditions.txt`
      const url = buildS3Url(bucket, key)

      if (!url) return yield* Effect.fail(new Error('URL not found'))

      const response = yield* Effect.tryPromise({
        try: () => fetch(url),
        catch: (error) => new Error(`Fetch failed: ${error}`),
      })

      if (!response.ok) {
        return yield* Effect.fail(new Error(`Response result was not ok. ${response.status}`))
      }

      return yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (error) => new Error(`Failed to read response text: ${error}`),
      })
    }),
  )

  if (Exit.isFailure(result)) {
    console.error('Error fetching terms and conditions', result.cause)
    return null
  }

  return result.value
}

async function loadMarathonMeta(domain: string): Promise<TermsPageMarathonMeta | null> {
  const result = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const marathonsRepository = yield* MarathonsRepository
      const marathon = yield* marathonsRepository.getMarathonByDomain({ domain })

      return yield* Option.match(marathon, {
        onSome: (m) =>
          Effect.succeed({
            name: m.name,
            logoUrl: m.logoUrl,
          }),
        onNone: () => Effect.fail(new Error('Marathon not found')),
      })
    }).pipe(Effect.provide(DbLayer)),
  )

  if (Exit.isFailure(result)) {
    console.error('Error fetching public marathon for terms page', result.cause)
    return null
  }

  return result.value
}

export const getTermsPageMarkdown = cache(async (domain: string): Promise<string | null> => {
  return unstable_cache(() => loadTermsMarkdown(domain), ['terms-page-markdown', domain], {
    revalidate: TERMS_MARKDOWN_REVALIDATE_SECONDS,
    tags: [termsMarkdownTag(domain)],
  })()
})

export const getTermsPageMarathonMeta = cache(
  async (domain: string): Promise<TermsPageMarathonMeta | null> => {
    return unstable_cache(() => loadMarathonMeta(domain), ['terms-page-marathon-meta', domain], {
      revalidate: TERMS_MARATHON_META_REVALIDATE_SECONDS,
      tags: [termsMarathonMetaTag(domain)],
    })()
  },
)
