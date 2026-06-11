import Link from 'next/link'
import { ReferenceSearch } from './reference-search'
import type { GalleryMarathonMeta } from '../_lib/types'

export function GalleryHeader({
  marathon,
  subtitle,
  homeHref,
  showSearch = true,
}: {
  marathon: GalleryMarathonMeta
  subtitle?: string
  homeHref: string
  showSearch?: boolean
}) {
  return (
    <header className="relative overflow-hidden border-b border-white/5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_60%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:gap-6 sm:px-6 sm:py-14">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href={homeHref} className="flex min-w-0 items-center gap-3">
            {marathon.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={marathon.logoUrl}
                alt={`${marathon.name} logo`}
                className="size-11 shrink-0 rounded-md object-cover ring-1 ring-white/10"
              />
            ) : null}
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-500">
                Gallery
              </span>
              <h1 className="text-wrap font-special-gothic text-xl leading-tight tracking-tight text-white sm:text-2xl">
                {marathon.name}
              </h1>
            </div>
          </Link>
          {showSearch ? <ReferenceSearch domain={marathon.domain} /> : null}
        </div>
        {subtitle ? (
          <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">{subtitle}</p>
        ) : null}
      </div>
    </header>
  )
}
