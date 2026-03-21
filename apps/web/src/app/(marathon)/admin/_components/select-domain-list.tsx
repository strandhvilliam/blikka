"use client"

import Link from "next/link"
import { useState } from "react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Trophy, ArrowRight, MapPin } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { formatDomainLink } from "@/lib/utils"
import { motion } from "motion/react"

export function SelectDomainList() {
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const trpc = useTRPC()
  const t = useTranslations("MarathonPage")

  const { data: marathons } = useSuspenseQuery(trpc.marathons.getUserMarathons.queryOptions())

  if (marathons.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trophy className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{t("noMarathonsTitle")}</EmptyTitle>
            <EmptyDescription>{t("noMarathonsDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col w-full gap-2.5">
      {marathons.map((marathon, index) => (
        <motion.div
          key={marathon.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: 0.15 + index * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Link
            prefetch={true}
            href={formatDomainLink(`/admin/dashboard`, marathon.domain)}
            className="group block"
          >
            <div className="relative rounded-2xl border border-brand-black/8 bg-white p-4 transition-all duration-200 hover:border-brand-black/14 hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)] hover:-translate-y-px">
              <div className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-black/8 bg-neutral-50 transition-colors group-hover:border-brand-primary/20 group-hover:bg-brand-primary/5">
                  {marathon.logoUrl && !imageErrors.has(marathon.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={marathon.logoUrl}
                      alt=""
                      className="size-full object-cover"
                      onError={() =>
                        setImageErrors((prev) => new Set(prev).add(marathon.id))
                      }
                    />
                  ) : (
                    <Trophy className="size-5 text-brand-black/30" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[15px] font-semibold leading-tight text-brand-black transition-colors group-hover:text-brand-primary">
                    {marathon.name}
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-brand-black/45">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">Stockholm</span>
                    <span className="text-brand-black/20 mx-0.5">·</span>
                    <span className="truncate font-mono text-[11px] tracking-wide text-brand-black/35">
                      {marathon.mode}
                    </span>
                    <span className="text-brand-black/20 mx-0.5">·</span>
                    <span className="truncate font-mono text-[11px] tracking-wide text-brand-black/30">
                      {marathon.domain}
                    </span>
                  </div>
                </div>

                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-brand-black/6 bg-neutral-50 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:border-brand-primary/20 group-hover:bg-brand-primary/5">
                  <ArrowRight className="size-3.5 text-brand-black/50 group-hover:text-brand-primary" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
