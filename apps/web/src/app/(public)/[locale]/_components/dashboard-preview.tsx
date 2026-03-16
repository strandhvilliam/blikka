"use client"

import Image from "next/image"
import { FadeIn } from "./fade-in"
import { NoiseOverlay } from "./noise-overlay"
import { Camera, Shield, Users } from "lucide-react"

const badges = [
  { icon: Camera, label: "Real-time uploads" },
  { icon: Users, label: "Judge management" },
  { icon: Shield, label: "Submission validation" },
]

export function DashboardPreview() {
  return (
    <section className="px-3 pb-6 lg:px-4 lg:pb-8">
      <div className="relative overflow-hidden rounded-2xl bg-brand-black px-6 py-16 md:px-10 md:py-20 lg:rounded-3xl lg:px-12 lg:py-24">
        <NoiseOverlay opacity={0.05} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(var(--brand-primary-rgb,200,80,50),0.15),transparent)]" />

        <div className="relative mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-10 text-center lg:mb-14">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-primary">
                Your Command Center
              </p>
              <h2 className="font-gothic mx-auto max-w-3xl text-balance text-3xl leading-snug font-normal tracking-tight text-brand-white md:text-4xl lg:text-[2.85rem] lg:leading-[1.15]">
                Everything happening at your event, visible in one dashboard
              </h2>
            </div>
          </FadeIn>

          <FadeIn delay={120}>
            <div className="relative">
              <div className="relative mx-auto overflow-hidden rounded-xl border border-brand-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] lg:rounded-2xl">
                <Image
                  src="/blikka-dashboard.png"
                  alt="Blikka organizer dashboard preview"
                  width={1920}
                  height={1080}
                  className="block w-full"
                />
              </div>

              <div className="pointer-events-none absolute -bottom-8 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-brand-primary/8 blur-3xl" />
            </div>
          </FadeIn>

          <FadeIn delay={240}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5 md:gap-3 lg:mt-14">
              {badges.map((badge) => {
                const Icon = badge.icon
                return (
                  <span
                    key={badge.label}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-white/10 bg-brand-white/5 px-3 py-2 text-xs text-brand-white/80 backdrop-blur-sm md:gap-2.5 md:px-4 md:py-2.5 md:text-sm"
                  >
                    <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                    {badge.label}
                  </span>
                )
              })}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
