'use client'

import { Heart, Trophy } from 'lucide-react'

export type JuryPickVariant = 'shortlist' | 'winner'

const idleByVariant: Record<JuryPickVariant, string> = {
  shortlist: 'border-brand-primary/25 bg-brand-primary/10 text-brand-primary',
  winner: 'border-amber-200/90 bg-amber-100 text-amber-800',
}

const wrapClass: Record<'md' | 'sm', string> = {
  md: 'h-7 w-7',
  sm: 'h-5 w-5',
}

const iconClass: Record<'md' | 'sm', string> = {
  md: 'h-3.5 w-3.5',
  sm: 'h-2.5 w-2.5',
}

export function JuryPickBadge({
  variant,
  tone = 'idle',
  size = 'md',
}: {
  variant: JuryPickVariant
  tone?: 'idle' | 'active'
  size?: 'md' | 'sm'
}) {
  const palette =
    tone === 'active' ? 'border-white/30 bg-white/15 text-white' : idleByVariant[variant]
  const Icon = variant === 'winner' ? Trophy : Heart

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${wrapClass[size]} ${palette}`}
      aria-hidden
    >
      <Icon
        className={`shrink-0 ${iconClass[size]}`}
        strokeWidth={size === 'sm' ? 2.5 : 2.25}
        fill={variant === 'shortlist' ? 'currentColor' : 'none'}
      />
    </span>
  )
}
