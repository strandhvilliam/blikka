import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PhotoReorderBannerProps {
  message: string
  className?: string
}

export function PhotoReorderBanner({ message, className }: PhotoReorderBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
      <span>{message}</span>
    </div>
  )
}
