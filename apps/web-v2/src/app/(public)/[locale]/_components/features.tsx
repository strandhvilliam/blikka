"use client"

import Image from "next/image"
import { FadeIn } from "./fade-in"

const services = [
  {
    image: "/images/photo-event-1.jpg",
    label: "UPLOADS",
    description:
      "Participants upload directly through a branded link. No accounts required, no friction, no lost entries.",
  },
  {
    image: "/images/photo-event-3.jpg",
    label: "GALLERIES",
    description:
      "Every entry is automatically organized into beautiful, shareable galleries by category or custom tags.",
  },
  {
    image: "/images/photo-event-5.jpg",
    label: "JUDGING",
    description:
      "Invite judges, set scoring criteria, and let the platform handle the rest. Fair, transparent, effortless.",
  },
]

export function Features() {
  return (
    <section id="features" className="px-6 py-24 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-6xl">
        {/* Section header — editorial style */}
        <div className="mb-20 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <FadeIn>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
                Features
              </p>
              <h2 className="max-w-xl text-balance text-3xl leading-snug font-normal tracking-tight text-foreground lg:text-[2.75rem] lg:leading-[1.2]">
                Collecting entries, organizing galleries, and celebrating great photography.
              </h2>
            </div>
          </FadeIn>
          <FadeIn delay={200}>
            <button className="mt-2 shrink-0 rounded-full border border-foreground/20 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background lg:mt-4">
              Explore
            </button>
          </FadeIn>
        </div>

        {/* Three large image cards — like screenshot 2 */}
        <div className="grid gap-6 lg:grid-cols-3">
          {services.map((service, index) => (
            <FadeIn key={service.label} delay={index * 150}>
              <div className="group">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
                  <Image
                    src={service.image}
                    alt={service.description}
                    fill
                    className="object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                  />
                </div>
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-foreground">
                    {service.label}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
