"use client"

import { FadeIn } from "./fade-in"

const brands = [
  "Stockholm Photo Festival",
  "Aperture Awards",
  "Urban Lens Collective",
  "Nordic Light",
  "Frame by Frame",
  "Shutter Summit",
  "Capture Conference",
  "Lens & Light Co.",
]

export function LogoStrip() {
  return (
    <section className="border-y border-border bg-card py-10">
      <FadeIn>
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Trusted by event organizers worldwide
        </p>
        <div className="relative overflow-hidden">
          <div className="flex animate-marquee items-center gap-12 whitespace-nowrap">
            {[...brands, ...brands].map((brand, index) => (
              <span
                key={`${brand}-${index}`}
                className="text-lg font-semibold text-foreground/20"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  )
}
