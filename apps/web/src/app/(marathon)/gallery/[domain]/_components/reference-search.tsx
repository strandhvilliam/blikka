'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { galleryParticipantHref } from '../_lib/href'

export function ReferenceSearch({
  domain,
  className,
}: {
  domain: string
  className?: string
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
    <form onSubmit={submit} className={cn('relative w-full max-w-sm', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Find by reference number"
        aria-label="Search submissions by participant reference number"
        className="h-11 w-full rounded-full border border-white/15 bg-white/5 pl-10 pr-24 font-mono text-sm text-white placeholder:font-sans placeholder:text-neutral-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-neutral-200"
      >
        Search
      </button>
    </form>
  )
}
