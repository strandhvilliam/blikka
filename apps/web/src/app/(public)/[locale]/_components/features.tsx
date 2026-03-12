"use client"

import Image from "next/image"
import { FadeIn } from "./fade-in"
import { eventImages } from "./landing-images"

const services = [
  {
    image: eventImages.photoEvent7,
    label: "UPLOADING",
    description:
      "No more cluttered Google Drive folders, messy email submissions, lost USB sticks, or long queues. Participants simply scan a QR code and upload their photos in seconds."
  },
  {
    image: eventImages.photoEvent3,
    label: "OVERVIEW",
    description: "Follow your photo event in real-time. See photos as they're uploaded, get notifications for invalid submissions, and generate contact sheets."
  },

  {
    image: eventImages.photoEvent5,
    label: "JUDGING",
    description:
      "Invite judges with a link. They can score entries while everything stays organized, and you can view the results in the dashboard."
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
              <h2 className="font-gothic max-w-xl text-balance text-3xl leading-snug font-normal tracking-tight text-foreground lg:text-[2.75rem] lg:leading-[1.2]">
                We take care of the tech behind the scenes, <span className="bg-brand-primary/20 px-1 text-foreground">from photo uploads to judging</span>, so you can focus on running the event.
              </h2>
            </div>
          </FadeIn>
          <FadeIn delay={200}>
            <button className="mt-2 shrink-0 rounded-full border border-foreground/20 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background lg:mt-4 bg-brand-white">
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
