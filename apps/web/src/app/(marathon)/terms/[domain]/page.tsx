import type { Metadata } from 'next'
import { TermsMarkdown } from '@/components/terms-markdown'
import { getTermsPageMarkdown, getTermsPageMarathonMeta } from '@/lib/terms-page-cache'
import { formatDomainLink } from '@/lib/utils'
import { TermsHero } from './_components/terms-hero'

export async function generateMetadata({
  params,
}: PageProps<'/terms/[domain]'>): Promise<Metadata> {
  const { domain } = await params
  const marathon = await getTermsPageMarathonMeta(domain)
  const name = marathon?.name ?? 'Photomarathon'
  return {
    title: `Terms and conditions · ${name}`,
  }
}

export default async function TermsPage({ params }: PageProps<'/terms/[domain]'>) {
  const { domain } = await params
  const [publicMarathon, markdown] = await Promise.all([
    getTermsPageMarathonMeta(domain),
    getTermsPageMarkdown(domain),
  ])

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
