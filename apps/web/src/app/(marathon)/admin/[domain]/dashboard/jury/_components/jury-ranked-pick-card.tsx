import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const MEDALS = {
  1: {
    label: '1st place',
    container: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30',
    badge: 'bg-amber-400 text-amber-950',
  },
  2: {
    label: '2nd place',
    container: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40',
    badge: 'bg-slate-300 text-slate-800',
  },
  3: {
    label: '3rd place',
    container: 'border-orange-200 bg-orange-50/70 dark:border-orange-900/60 dark:bg-orange-950/30',
    badge: 'bg-orange-300 text-orange-950',
  },
} as const

interface JuryRankedPickCardProps {
  rank: 1 | 2 | 3
  participantReference?: string | null
}

export function JuryRankedPickCard({ rank, participantReference }: JuryRankedPickCardProps) {
  const medal = MEDALS[rank]
  const isSelected = participantReference != null

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2.5',
        isSelected ? medal.container : 'border-border/60 bg-muted/20',
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isSelected ? medal.badge : 'bg-muted text-muted-foreground',
        )}
      >
        <Trophy className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {medal.label}
        </p>
        <p className="truncate text-[13px] font-semibold tabular-nums">
          {isSelected ? `#${participantReference}` : 'Not selected'}
        </p>
      </div>
    </div>
  )
}
