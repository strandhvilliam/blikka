import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function JuryListSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-4 px-2">
        <Search className="absolute left-5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search invitations..."
          className="pl-9 h-9 bg-muted/50 border-border/40"
          disabled
        />
      </div>
      <div className="space-y-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

