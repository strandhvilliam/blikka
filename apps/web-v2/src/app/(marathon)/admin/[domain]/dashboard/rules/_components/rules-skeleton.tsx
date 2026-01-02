import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function RulesSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-10 max-w-4xl">
      <div className="space-y-1">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-96" />
      </div>

      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
