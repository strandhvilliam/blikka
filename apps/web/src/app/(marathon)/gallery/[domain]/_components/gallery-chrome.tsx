import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/** "1st" / "2nd" / "3rd" / "Nth" for a 1-based rank. */
export function ordinalLabel(rank: number): string {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  if (rank === 3) return '3rd'
  return `${rank}th`
}

/**
 * Rank badge — a clear circular placement number, monochrome so the orange accent stays
 * reserved for action buttons. 1st place is a solid white disc; 2nd/3rd are outlined
 * discs so the hierarchy still reads at a glance.
 */
export function RankMedal({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      aria-label={`${ordinalLabel(rank)} place`}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-base font-bold tabular-nums backdrop-blur',
        rank === 1
          ? 'bg-white text-black shadow-[0_2px_12px_rgba(0,0,0,0.35)]'
          : 'border border-white/40 bg-black/55 text-white shadow-[0_2px_12px_rgba(0,0,0,0.35)]',
        className,
      )}
    >
      {rank}
    </span>
  )
}

/**
 * Consistent "go up a level" affordance. Generous tap target (min-h-9, gap, padding)
 * for mobile, and a single style so every back path reads the same.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-full px-1 text-sm text-neutral-400 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <ChevronLeft className="size-4 shrink-0" />
      {label}
    </Link>
  )
}

/** Small uppercase label used above titles across the gallery. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-500',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Section heading. `lg` is the page-level heading (e.g. "Winners") — a clean title with
 * optional right-aligned meta, no rule. `md` is a section within it — the title with a
 * hairline rule filling the row to anchor it, plus optional meta.
 */
export function SectionHeading({
  title,
  meta,
  size = 'md',
}: {
  title: string
  meta?: React.ReactNode
  size?: 'md' | 'lg'
}) {
  if (size === 'lg') {
    return (
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h2 className="font-gothic text-3xl font-normal leading-tight tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        {meta ? <span className="shrink-0 text-xs text-neutral-500">{meta}</span> : null}
      </div>
    )
  }

  return (
    <div className="mb-6 flex items-center gap-4">
      <h2 className="font-gothic text-xl font-normal leading-tight tracking-tight text-white sm:text-2xl">
        {title}
      </h2>
      <span className="h-px flex-1 bg-white/10" />
      {meta ? <span className="shrink-0 text-xs text-neutral-500">{meta}</span> : null}
    </div>
  )
}
