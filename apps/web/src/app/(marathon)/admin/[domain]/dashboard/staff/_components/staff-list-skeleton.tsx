import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function StaffListSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-4 px-2">
        <Search className="absolute left-6.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search staff..."
          className="pl-9 h-9 bg-muted/50 border-border/40"
          disabled
        />
      </div>
      <div className="space-y-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
