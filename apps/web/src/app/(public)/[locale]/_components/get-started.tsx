"use client"

import { ArrowRight } from "lucide-react"
import { FadeIn } from "./fade-in"
import { GetStartedDialog } from "./get-started-dialog"
import { NoiseOverlay } from "./noise-overlay"

export function GetStarted() {
  return (
    <section id="pricing" className="scroll-mt-28 px-3 py-6 lg:px-4 lg:py-8 lg:scroll-mt-32">
      <div className="relative overflow-hidden rounded-2xl bg-brand-black px-6 py-24 md:px-10 md:py-28 lg:rounded-3xl lg:px-12 lg:py-32">
        <NoiseOverlay opacity={0.1} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(var(--brand-primary-rgb,200,80,50),0.12),transparent)]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <FadeIn>
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-brand-primary">
              Get Started
            </p>
            <h2 className="font-gothic text-balance text-3xl leading-snug font-normal tracking-tight text-brand-white md:text-4xl lg:text-[3.25rem] lg:leading-[1.1]">
              Ready to run your next event without the usual chaos?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-brand-white/60 lg:text-lg">
              Book a focused 20-minute demo. You will leave with a rollout plan, clear pricing, and
              a setup tailored to your event.
            </p>
          </FadeIn>

          <FadeIn delay={150}>
            <div className="mt-10 flex flex-col items-center gap-4">
              <GetStartedDialog>
                <button
                  type="button"
                  className="group inline-flex items-center gap-2 rounded-full bg-brand-primary px-9 py-4 text-base font-semibold text-brand-white transition-[background-color,gap] duration-200 hover:gap-3 hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black"
                >
                  Book a demo
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </GetStartedDialog>
              <p className="text-sm text-brand-white/40">
                No commitment. Usually scheduled within one week.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
