import { CardContent } from "@/components/ui/card"
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
  iconContainerClassName = "p-2 rounded-lg bg-muted border",
  title,
  description,
  action,
  className,
}: ParticipantCardProps) {
  return (
    <div
      className={cn(
        "items-center flex rounded-lg border border-border min-w-[260px] bg-background",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(iconContainerClassName)}>
            <span className="flex items-center justify-center">{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate flex items-center gap-1">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
            )}
            {action && <div className="mt-1">{action}</div>}
          </div>
        </div>
      </CardContent>
    </div>
  )
}
