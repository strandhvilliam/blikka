import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JuryInvitation } from '@blikka/db'

interface JuryInvitationStatusBadgeProps {
  status: JuryInvitation['status']
  isActive?: boolean
}

export function JuryInvitationStatusBadge({ status, isActive = false }: JuryInvitationStatusBadgeProps) {
  const baseClasses =
    'text-xs font-medium gap-1 h-5 px-1.5 shrink-0 [&>svg]:size-2.5 border'

  switch (status) {
    case 'completed':
      return (
        <Badge
          variant="outline"
          className={cn(
            baseClasses,
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
            isActive && 'ring-2 ring-primary/40 ring-offset-1',
          )}
        >
          <CheckCircle2 />
          Completed
        </Badge>
      )
    case 'in_progress':
      return (
        <Badge
          variant="outline"
          className={cn(
            baseClasses,
            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
            isActive && 'ring-2 ring-primary/40 ring-offset-1',
          )}
        >
          <Clock />
          In Progress
        </Badge>
      )
    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            baseClasses,
            'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
            isActive && 'ring-2 ring-primary/40 ring-offset-1',
          )}
        >
          <Clock />
          Pending
        </Badge>
      )
  }
}
