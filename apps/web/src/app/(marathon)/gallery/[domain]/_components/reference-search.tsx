'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { galleryParticipantHref } from '../_lib/href'

export function ReferenceSearch({
  domain,
  className,
  compact = false,
}: {
  domain: string
  className?: string
  /** Condensed variant used by the sticky header so it fits a single slim row. */
  compact?: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState('')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const reference = value.trim()
    if (!reference) return
    router.push(galleryParticipantHref(domain, reference))
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'relative transition-[width] duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]',
        compact ? 'w-40 shrink-0 sm:w-72' : 'w-full max-w-sm sm:w-80 md:w-96',
        className,
      )}
    >
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-neutral-500',
          compact ? 'left-3 size-3.5' : 'left-4 size-4',
        )}
      />
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={compact ? 'Reference' : 'Find by reference number'}
        aria-label="Search submissions by participant reference number"
        className={cn(
          'w-full rounded-full border border-white/12 bg-white/[0.04] font-mono text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors placeholder:font-sans placeholder:text-neutral-500 focus:border-white/30 focus:bg-white/[0.06] focus:outline-none',
          compact ? 'h-10 pl-9 pr-[4.25rem] text-xs' : 'h-12 pl-11 pr-[5.5rem] text-sm',
        )}
      />
      <button
        type="submit"
        className={cn(
          'absolute top-1/2 -translate-y-1/2 touch-manipulation rounded-full bg-brand-primary font-semibold tracking-wide text-brand-white transition-colors hover:bg-brand-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          compact ? 'right-1 h-8 px-3 text-[11px]' : 'right-1.5 h-9 px-4 text-xs',
        )}
      >
        Search
      </button>
    </form>
  )
}
