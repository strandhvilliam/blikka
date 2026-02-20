"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { FadeIn } from "./fade-in"

export function CTA() {
  return (
    <section className="bg-brand-black px-6 py-24 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-4xl text-center">
        <FadeIn>
          <h2 className="text-balance text-3xl leading-snug font-normal tracking-tight text-brand-white lg:text-[3.25rem] lg:leading-[1.15]">
            Ready to run your next photo competition?
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-brand-white/50">
            Join hundreds of organizers already using blikka to celebrate
            photography. Set up your first event in under 5 minutes.
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="#"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-primary px-8 py-4 text-sm font-medium text-brand-white transition-all hover:gap-3 hover:bg-brand-primary/90"
            >
              Create your first event
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#"
              className="inline-flex items-center gap-2 rounded-full border border-brand-white/20 px-8 py-4 text-sm text-brand-white transition-colors hover:bg-brand-white/10"
            >
              Talk to sales
            </Link>
          </div>
          <p className="mt-8 text-xs text-brand-white/30">
            No credit card required. Free plan available.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
