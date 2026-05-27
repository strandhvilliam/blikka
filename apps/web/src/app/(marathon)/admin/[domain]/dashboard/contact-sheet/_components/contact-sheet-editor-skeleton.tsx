import { Skeleton } from '@/components/ui/skeleton'

export function ContactSheetEditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-4">
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-40" />
          </div>
        </div>
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton
            className="w-full rounded-xl"
            style={{ aspectRatio: 3986 / 2657 }}
          />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[420px] w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
