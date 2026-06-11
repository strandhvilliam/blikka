import { Skeleton } from '@/components/ui/skeleton'

export function GalleryAdminSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-4">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-28" />
          </div>
        </div>
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="mt-1 h-4 w-full max-w-md" />
      </div>

      <Skeleton className="mb-8 h-24 w-full rounded-xl" />

      <div className="mb-4 flex items-center gap-2.5">
        <Skeleton className="h-1.5 w-1.5 rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="mb-5 h-4 w-full max-w-lg" />

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <Skeleton className="h-36 w-full rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-44 w-full rounded-lg" />
          </div>
        </div>
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 sm:px-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </div>
  )
}
