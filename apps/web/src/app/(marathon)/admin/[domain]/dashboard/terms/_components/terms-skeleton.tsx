import { Skeleton } from '@/components/ui/skeleton'

export function TermsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-4">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex flex-col rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
        <Skeleton className="min-h-[360px] h-[clamp(360px,calc(100dvh-360px),720px)] w-full rounded-none" />
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </div>
  )
}
