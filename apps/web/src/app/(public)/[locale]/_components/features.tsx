"use client"

import Image from "next/image"
import { FadeIn } from "./fade-in"

const features = [
  {
    image: "/feature-phone.png",
    label: "Uploading",
    description:
      "No more cluttered Google Drive folders, messy email submissions, lost USB sticks, or long queues. Participants simply scan a QR code and upload their photos in seconds.",
  },
  {
    image: "/feature-dashboard.png",
    label: "Administrating",
    description:
      "Follow your photo event in real-time. See photos as they're uploaded, get notifications for invalid submissions, and generate contact sheets.",
  },
  {
    image: "/feature-judging.png",
    label: "Judging",
    description:
      "Invite judges with a link. They can score entries while everything stays organized, and you can view the results in the dashboard.",
  },
]

export function Features() {
  return (
    <section id="features" className="px-6 py-24 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 flex flex-col gap-6 lg:mb-20 lg:flex-row lg:items-end lg:justify-between">
          <FadeIn>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
                Features
              </p>
              <h2 className="font-gothic max-w-xl text-balance text-3xl leading-snug font-normal tracking-tight text-foreground lg:text-[2.75rem] lg:leading-[1.2]">
                Simple, streamlined, and <span className="bg-brand-primary/20 px-1 text-foreground">stress-free</span>
              </h2>
            </div>
          </FadeIn>
          <FadeIn delay={150}>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground lg:text-right">
              Everything your photo event needs. Collecting entries, managing submissions, and scoring winners, in a single platform.
            </p>
          </FadeIn>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FadeIn key={feature.label} delay={index * 120}>
              <div className="group">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#f8f7f6] transition-shadow duration-500 group-hover:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.08)]">
                  <Image
                    src={feature.image}
                    alt={feature.label}
                    fill
                    className="object-contain p-4 transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
                      {feature.label}
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
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
