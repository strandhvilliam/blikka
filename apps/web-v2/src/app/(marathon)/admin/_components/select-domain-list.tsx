"use client"

import Link from "next/link"
import { Card, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Trophy, ArrowRight, MapPin } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { formatSubdomainUrl } from "@/lib/utils"

export function SelectDomainList() {
  const trpc = useTRPC()
  const t = useTranslations("MarathonPage")

  const { data: marathons } = useSuspenseQuery(trpc.marathons.getUserMarathons.queryOptions())

  if (marathons.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trophy className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t("noMarathonsTitle")}</EmptyTitle>
          <EmptyDescription>{t("noMarathonsDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col w-full gap-3">
      {marathons.map((marathon) => (
        <Link
          key={marathon.id}
          prefetch={true}
          href={formatSubdomainUrl(marathon.domain)}
          className="block group"
        >
          <Card className="flex flex-row items-center gap-4 p-5 w-full transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 cursor-pointer">
            <div className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
              {/* TODO: Add logo */}
              <Trophy className="size-5" />
            </div>
            <div className="flex flex-col flex-1 min-w-0 gap-1">
              <CardTitle className="text-base font-semibold leading-tight group-hover:text-primary transition-colors">
                {marathon.name}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">Stockholm</span>
                <span className="text-muted-foreground/60">•</span>
                <span className="truncate font-mono text-xs">{marathon.domain}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 size-9 opacity-0 group-hover:opacity-100 transition-opacity"
              asChild
            >
              <div>
                <ArrowRight className="size-4" />
              </div>
            </Button>
          </Card>
        </Link>
      ))}
    </div>
  )
}
