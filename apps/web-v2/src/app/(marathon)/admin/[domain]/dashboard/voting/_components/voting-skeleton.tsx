"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function VotingSkeleton() {
  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-5 w-[420px] max-w-full" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
