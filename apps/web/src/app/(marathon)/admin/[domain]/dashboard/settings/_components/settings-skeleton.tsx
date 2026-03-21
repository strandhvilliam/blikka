import { Skeleton } from "@/components/ui/skeleton"

export function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-5 gap-12">
        <div className="col-span-3 rounded-xl border border-border bg-white py-5 px-6">
          <div className="space-y-6">
            <div className="border-b border-border flex gap-8 pb-0">
              {["w-16", "w-20", "w-20", "w-28", "w-24"].map((w, i) => (
                <div key={i} className="pb-4">
                  <Skeleton className={`h-4 ${w}`} />
                </div>
              ))}
            </div>

            <div className="space-y-6 pt-2">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-3.5 w-12" />
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <Skeleton className="h-10 flex-1 rounded-md" />
                </div>
              </div>

              <div className="space-y-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-40 w-full rounded-md" />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        <div className="col-span-2">
          <Skeleton className="h-5 w-16 mb-4" />
          <div className="w-full max-w-[300px] aspect-[9/19] rounded-[36px] border-[6px] border-muted overflow-hidden">
            <Skeleton className="w-full h-full rounded-[30px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
