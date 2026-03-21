import { Skeleton } from "@/components/ui/skeleton"

export function SelectDomainSkeleton() {
  return (
    <div className="flex flex-col w-full gap-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-brand-black/8 bg-white p-4"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
