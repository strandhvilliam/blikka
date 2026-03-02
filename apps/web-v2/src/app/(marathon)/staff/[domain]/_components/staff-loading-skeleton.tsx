import { Skeleton } from "@/components/ui/skeleton"

export function StaffLoadingSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-between px-6 py-8">
      <div className="flex w-full flex-col items-center gap-3 pt-8">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-12 w-56 rounded-full" />
        <Skeleton className="h-5 w-64 rounded-full" />
      </div>
      <div className="flex flex-col items-center gap-5">
        <Skeleton className="h-52 w-52 rounded-full" />
        <Skeleton className="h-5 w-32 rounded-full" />
      </div>
      <div className="flex gap-8 pb-4">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      </div>
    </div>
  )
}
