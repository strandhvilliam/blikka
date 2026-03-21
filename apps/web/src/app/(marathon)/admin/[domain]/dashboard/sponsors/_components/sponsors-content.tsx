"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { SponsorCard } from "./sponsor-card"
import { SponsorsHeader } from "./sponsors-header"
import { Smartphone, FileText } from "lucide-react"

export function SponsorsContent() {
  const trpc = useTRPC()
  const domain = useDomain()

  const { data: sponsors } = useSuspenseQuery(
    trpc.sponsors.getByMarathon.queryOptions({
      domain,
    })
  )

  const getSponsorImage = (type: string) => {
    return sponsors
      .filter((s) => s.type === type)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .at(-1)
  }

  const allTypes = [
    "contact-sheets",
    "live-initial-1",
    "live-initial-2",
    "live-success-1",
    "live-success-2",
  ] as const

  const activeCount = allTypes.filter((type) => getSponsorImage(type)).length

  return (
    <div>
      <SponsorsHeader activeCount={activeCount} totalCount={allTypes.length} />

      <div className="space-y-10">
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              In-App Placements
            </p>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-5 max-w-md">
            Sponsor images shown inside the participant upload app during the event.
          </p>
          <div className="space-y-3">
            <SponsorCard
              title="Start Screen — Slot 1"
              description="Primary sponsor image on the app landing page"
              type="live-initial-1"
              sponsor={getSponsorImage("live-initial-1")}
              icon={Smartphone}
            />
            <SponsorCard
              title="Start Screen — Slot 2"
              description="Secondary sponsor image on the app landing page"
              type="live-initial-2"
              sponsor={getSponsorImage("live-initial-2")}
              icon={Smartphone}
            />
            <SponsorCard
              title="Success Screen — Slot 1"
              description="Primary sponsor image after a successful upload"
              type="live-success-1"
              disabled
              sponsor={getSponsorImage("live-success-1")}
              icon={Smartphone}
            />
            <SponsorCard
              title="Success Screen — Slot 2"
              description="Secondary sponsor image after a successful upload"
              type="live-success-2"
              disabled
              sponsor={getSponsorImage("live-success-2")}
              icon={Smartphone}
            />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Print Placements
            </p>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-5 max-w-md">
            Sponsor images printed on generated contact sheets and physical materials.
          </p>
          <div className="space-y-3">
            <SponsorCard
              title="Contact Sheet"
              description="Sponsor image printed on every participant contact sheet"
              type="contact-sheets"
              sponsor={getSponsorImage("contact-sheets")}
              icon={FileText}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
