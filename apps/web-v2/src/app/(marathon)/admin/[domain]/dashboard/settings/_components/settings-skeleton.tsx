import { Skeleton } from "@/components/ui/skeleton"

export function SettingsSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-10 max-w-[1400px]">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Settings form skeleton */}
      <div className="grid grid-cols-2 gap-12">
        <div>
          <div className="space-y-6">
            <div className="border-b border-muted-foreground/25 w-full flex justify-start">
              <div className="px-4 py-2 border-b-2 border-primary">
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="px-4 py-2">
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="px-4 py-2">
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="px-4 py-2">
                <Skeleton className="h-5 w-24" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 max-w-2xl">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-[42px] h-[42px] rounded-full" />
                    <Skeleton className="px-4 w-full h-[42px] rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Phone preview skeleton */}
        <div className="relative w-fit">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="w-[340px] h-[680px] rounded-[40px] border-8 border-muted p-2 overflow-hidden">
            <Skeleton className="w-full h-full rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
