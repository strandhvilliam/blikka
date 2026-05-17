import { cacheLife, cacheTag } from 'next/cache'
import { Config, Effect, Exit, Option } from 'effect'
import type { Metadata } from 'next'
import { DbLayer, MarathonsRepository } from '@blikka/db'
import { TermsMarkdown } from '@/components/terms-markdown'
import { buildS3Url, formatDomainLink } from '@/lib/utils'
import { TermsHero } from './_components/terms-hero'

const getTermsMarkdown = async function getTermsMarkdown(domain: string) {
  'use cache'
  cacheTag(`terms-${domain}`)
  cacheLife('minutes')

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

      if (!response.ok)
        return yield* Effect.fail(new Error(`Response result was not ok. ${response.status}`))

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

const getPublicMarathon = async function getPublicMarathon(domain: string) {
  'use cache'
  cacheTag(`public-marathon-${domain}`)
  cacheLife('minutes')

  const result = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const marathonsRepository = yield* MarathonsRepository
      const marathon = yield* marathonsRepository.getMarathonByDomain({
        domain,
      })

      return yield* Option.match(marathon, {
        onSome: (m) => Effect.succeed(m),
        onNone: () => Effect.fail(new Error('Marathon not found')),
      })
    }).pipe(Effect.provide(DbLayer)),
  )

  if (Exit.isFailure(result)) {
    console.error('Error fetching public marathon', result.cause)
    return null
  }
  return result.value
}

export async function generateMetadata({
  params,
}: PageProps<'/terms/[domain]'>): Promise<Metadata> {
  const { domain } = await params
  const marathon = await getPublicMarathon(domain)
  const name = marathon?.name ?? 'Photomarathon'
  return {
    title: `Terms and conditions · ${name}`,
  }
}

export default async function TermsPage({ params }: PageProps<'/terms/[domain]'>) {
  const { domain } = await params
  const publicMarathon = await getPublicMarathon(domain)
  const markdown = await getTermsMarkdown(domain)

  const marathonName = publicMarathon?.name ?? 'Photomarathon'
  const eventHomeHref = formatDomainLink('/', domain, 'live')

  return (
    <main className="mx-auto min-h-svh w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <TermsHero domain={domain} marathonName={marathonName} logoUrl={publicMarathon?.logoUrl} />

      <div className="pt-10">
        {markdown ? (
          <TermsMarkdown markdown={markdown} />
        ) : (
          <div className="space-y-4 text-center sm:text-left">
            <p className="text-sm text-muted-foreground">Terms and conditions are not available.</p>
            <a
              href={eventHomeHref}
              className="inline-flex text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
            >
              Back to event home
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
