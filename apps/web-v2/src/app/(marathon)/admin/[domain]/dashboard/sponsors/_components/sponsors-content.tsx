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
          title="Participant Initial Page"
          description="Sponsor image shown on the app initial page"
          type="participant-initial"
          disabled
          sponsor={getSponsorImage("participant-initial")}
        />

        <SponsorCard
          title="Participant Success Page"
          description="Sponsor image shown on the app success page"
          type="participant-success"
          disabled
          sponsor={getSponsorImage("participant-success")}
        />
      </div>
    </div>
  )
}

