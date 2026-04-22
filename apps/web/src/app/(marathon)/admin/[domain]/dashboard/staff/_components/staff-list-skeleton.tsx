import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function StaffListSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            className="h-9 border-border/40 bg-muted/50 pl-9"
            disabled
          />
        </div>
      </div>
      <div className="min-w-0 space-y-0.5">
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
