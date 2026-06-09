import { Skeleton } from '@/components/ui/skeleton'

export function GalleryAdminSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="space-y-3 rounded-xl border p-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
