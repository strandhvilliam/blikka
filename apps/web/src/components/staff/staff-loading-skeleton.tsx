import { Skeleton } from "@/components/ui/skeleton";

export function StaffLoadingSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-between px-5 pb-6 pt-2">
        <div className="flex flex-col items-center gap-2 pt-6">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-10 w-52 rounded-full" />
          <Skeleton className="h-4 w-56 rounded-full" />
        </div>

        <div className="flex flex-col items-center gap-4 py-8">
          <Skeleton className="h-44 w-44 rounded-full sm:h-52 sm:w-52" />
          <Skeleton className="h-4 w-36 rounded-full" />
        </div>

        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-white/95 p-4">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2.5 py-4">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
