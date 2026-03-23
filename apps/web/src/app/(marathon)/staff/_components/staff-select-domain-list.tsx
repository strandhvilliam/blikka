"use client"

import Link from "next/link"
import { ShieldCheck, ArrowRight, MapPin } from "lucide-react"
import { useSuspenseQuery } from "@tanstack/react-query"

import { useTRPC } from "@/lib/trpc/client"
import { formatDomainPathname } from "@/lib/utils"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function StaffSelectDomainList() {
  const trpc = useTRPC()
  const { data: marathons } = useSuspenseQuery(trpc.marathons.getUserMarathons.queryOptions())

  if (marathons.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No staff marathons available</EmptyTitle>
          <EmptyDescription>
            You do not currently have access to any marathon staff desks.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {marathons.map((marathon) => (
        <Link
          key={marathon.id}
          prefetch={true}
          href={formatDomainPathname("/staff", marathon.domain, "staff")}
          className="group block"
        >
          <div className="flex w-full items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/6 text-foreground transition-colors group-hover:bg-foreground/10">
              <ShieldCheck className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-base font-semibold leading-tight text-foreground">
                {marathon.name}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">Staff desk</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="truncate font-mono text-xs">{marathon.domain}</span>
              </div>
            </div>
            <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowRight className="size-4 text-muted-foreground" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
