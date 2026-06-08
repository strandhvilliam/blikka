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
      <div className="relative z-10 min-h-screen bg-black text-neutral-200 antialiased">
        {children}
      </div>
    </DomainProvider>
  )
}
