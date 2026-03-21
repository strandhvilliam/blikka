import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface ParticipantCardProps {
  icon: ReactNode
  iconContainerClassName?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function ParticipantCard({
  icon,
  iconContainerClassName = "p-2 rounded-lg bg-muted/80 border border-border/60",
  title,
  description,
  action,
  className,
}: ParticipantCardProps) {
  return (
    <div
      className={cn(
        "items-center flex rounded-xl border border-border min-w-[260px] bg-white transition-shadow duration-200 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(iconContainerClassName)}>
            <span className="flex items-center justify-center">{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[13px] truncate flex items-center gap-1">{title}</h3>
            {description && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
            )}
            {action && <div className="mt-1.5">{action}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
