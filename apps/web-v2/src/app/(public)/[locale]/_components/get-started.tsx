"use client"

import Link from "next/link"
import { ArrowRight, CalendarDays, Clock3, Users } from "lucide-react"
import { FadeIn } from "./fade-in"

export function GetStarted() {
  return (
    <section
      id="pricing"
      className="border-t border-border bg-background px-6 py-24 lg:px-12 lg:py-36"
    >
      <div className="mx-auto max-w-4xl">
        <FadeIn>
          <div className="text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
              Get started
            </p>
            <h2 className="font-gothic text-balance text-3xl leading-snug font-normal tracking-tight text-foreground lg:text-[3rem] lg:leading-[1.15]">
              Let us set up your first event together
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Pricing is based on the number of events and expected
              participants — no hidden fees. Book a short
              demo and we will map your setup, walk through the platform, and
              share a clear quote.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={150}>
          <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-brand-primary/25 bg-brand-black p-8 text-brand-white lg:p-10">
            <h3 className="text-2xl leading-tight font-semibold text-balance">
              Book a 20-minute demo
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-brand-white/70">
              We will walk through your event format, participant flow, and
              judging setup so your launch plan is clear from day one.
            </p>

            <ul className="mt-7 grid gap-3 text-sm text-brand-white/80 sm:grid-cols-2">
              <li className="flex items-center gap-2.5">
                <Clock3
                  className="h-4 w-4 shrink-0 text-brand-primary"
                  aria-hidden="true"
                />
                Live product walkthrough
              </li>
              <li className="flex items-center gap-2.5">
                <CalendarDays
                  className="h-4 w-4 shrink-0 text-brand-primary"
                  aria-hidden="true"
                />
                Suggested rollout plan
              </li>
              <li className="flex items-center gap-2.5">
                <Users
                  className="h-4 w-4 shrink-0 text-brand-primary"
                  aria-hidden="true"
                />
                Pricing matched to your scope
              </li>
              <li className="flex items-center gap-2.5">
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-brand-primary"
                  aria-hidden="true"
                />
                Q&A with our team
              </li>
            </ul>

            <div className="mt-8 flex flex-col items-center gap-3">
              <Link
                href="#"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-8 py-3.5 text-sm font-semibold text-brand-white transition-[background-color,gap] duration-200 hover:gap-3 hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black"
              >
                Book a demo
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <p className="text-xs text-brand-white/45">
                Usually scheduled within one week.
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
