import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function ExportCardSkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1">
        <Skeleton className="h-full w-full rounded-none" />
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-3 w-60 max-w-full" />
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ExportSkeleton() {
  return (
    <div className="container mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ExportCardSkeleton />
        <ExportCardSkeleton />
        <ExportCardSkeleton />
        <ExportCardSkeleton />
      </div>
    </div>
  )
}
