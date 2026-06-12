import { DomainProvider } from '@/lib/domain-provider'

export default async function GalleryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  return (
    <DomainProvider domain={domain}>
      {/* Soft charcoal base — easier on the eyes than pure black. Tune via --gallery-bg;
          the sticky header and filter bar read the same variable so they stay in sync. */}
      <div className="relative z-10 min-h-screen [--gallery-bg:#141417] bg-[var(--gallery-bg)] text-neutral-200 antialiased">
        {children}
      </div>
    </DomainProvider>
  )
}
