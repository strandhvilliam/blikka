"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { SponsorCard } from "./sponsor-card"
import { SponsorsHeader } from "./sponsors-header"

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

  return (
    <div className="container max-w-[1400px] mx-auto py-8">
      <div className="flex flex-col mb-8 gap-1">
        <SponsorsHeader />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SponsorCard
          title="Contact Sheets"
          description="Sponsor image displayed on contact sheets"
          type="contact-sheets"
          sponsor={getSponsorImage("contact-sheets")}
        />

        <SponsorCard
          title="Live Initial Page 1"
          description="First sponsor image shown on the app initial page"
          type="live-initial-1"
          sponsor={getSponsorImage("live-initial-1")}
        />

        <SponsorCard
          title="Live Initial Page 2"
          description="Second sponsor image shown on the app initial page"
          type="live-initial-2"
          sponsor={getSponsorImage("live-initial-2")}
        />

        <SponsorCard
          title="Live Success Page 1"
          description="First sponsor image shown on the app success page"
          type="live-success-1"
          disabled
          sponsor={getSponsorImage("live-success-1")}
        />
        <SponsorCard
          title="Live Success Page 2"
          description="Second sponsor image shown on the app success page"
          type="live-success-2"
          disabled
          sponsor={getSponsorImage("live-success-2")}
        />
      </div>
    </div>
  )
}

