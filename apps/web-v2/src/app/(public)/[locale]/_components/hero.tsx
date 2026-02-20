import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CalendarDays } from "lucide-react"
import { NoiseOverlay } from "./noise-overlay"

export function Hero() {
  return (
    <div className="bg-background p-3 lg:p-4">
      <section className="relative flex min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl lg:min-h-[calc(100vh-2rem)] lg:rounded-3xl">
        {/* Background image */}
        <div className="absolute inset-0 animate-hero-fade-in-from-bottom">
          <Image
            src="/blikka-hero2.jpg"
            alt="Photographer with vintage camera in black and white"
            fill
            className="rounded-2xl object-cover lg:rounded-3xl"
            priority
            quality={100}
          />
          {/* Layered overlays for depth */}
          <div className="absolute inset-0 rounded-2xl bg-brand-black/10 lg:rounded-3xl" />
          <NoiseOverlay />
          {/* <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/90 via-black/20 to-transparent lg:rounded-3xl" /> */}
          {/* <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-black/60 via-transparent to-transparent lg:rounded-3xl" /> */}
        </div>

        {/* Top-right upcoming event card */}
        <div className="absolute top-28 right-8 z-10 hidden w-full max-w-[340px] animate-hero-fade-in [animation-delay:320ms] lg:block">
          <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/35 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 rounded-2xl " />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full border border-white/25 bg-black/30 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/85 uppercase">
                  Upcoming Event
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/40 bg-brand-primary/10 px-2 py-1 text-[11px] font-semibold text-brand-primary">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  2026
                </span>
              </div>

              <p className="text-xl leading-tight font-semibold text-white text-pretty">
                Stockholm Fotomaraton 2026
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                Ticket sales are open now. Secure your spot before it sells out.
              </p>

              <Link
                href="https://billetto.se/e/stockholm-fotomaraton-2026-biljetter-1361256"
                className="group mt-5 inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-xs font-semibold tracking-wide text-brand-white transition-[background-color,transform] duration-200 hover:bg-brand-primary/90 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70"
              >
                Buy Tickets
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        {/* Content area - bottom aligned */}
        <div className="relative z-10 mt-auto flex w-full flex-col px-6 pb-12 pt-48 lg:px-12 lg:pb-16">
          {/* Oversized brand name */}
          <h1 className="font-special-gothic -ml-4 text-[clamp(4.5rem,18vw,14rem)] leading-[0.8] tracking-tighter text-white animate-hero-fade-in-from-left [animation-delay:150ms]">
            blikka
          </h1>

          {/* Tagline with accent line */}
          <div className="mt-6 flex items-start gap-4 lg:mt-8 animate-hero-fade-in [animation-delay:250ms]">
            <p className="max-w-xl text-base leading-relaxed text-white/70 lg:max-w-2xl lg:text-lg">
              The simplest way to collect and showcase photo competition entries.
              Built for organizers who care about the creative experience.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center lg:mt-10 animate-hero-fade-in [animation-delay:350ms]">
            <Link
              href="#pricing"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-primary px-7 py-3.5 text-sm font-medium text-brand-white transition-[background-color,gap] duration-200 hover:gap-3 hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70"
            >
              Book a demo
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
