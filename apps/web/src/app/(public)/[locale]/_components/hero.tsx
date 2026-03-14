import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CalendarDays, Ticket } from "lucide-react"
import { NoiseOverlay } from "./noise-overlay"

export function Hero() {
  return (
    <div className="bg-background p-3 lg:p-4">
      <section className="relative flex min-h-[80svh] overflow-hidden rounded-2xl lg:min-h-[calc(100vh-2rem)] lg:rounded-3xl">
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
        <div className="absolute top-28 right-8 z-10 hidden w-full max-w-[300px] animate-hero-fade-in [animation-delay:320ms] lg:block xl:max-w-[340px]">
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

        {/* Content area - vertically centred on mobile, bottom-aligned on desktop */}
        <div className="relative z-10 mt-auto flex w-full min-w-0 flex-col px-6 pb-10 pt-24 md:px-10 md:pb-12 lg:px-12 lg:pb-16 lg:pt-48">
          <h1 className="font-special-gothic text-center text-[clamp(2rem,8vw,3.5rem)] max-w-308 leading-[0.85] tracking-tighter text-white animate-hero-fade-in-from-left [animation-delay:150ms] sm:-ml-2 sm:text-left lg:max-w-[60%] lg:text-[clamp(3rem,5vw,5.6rem)] xl:max-w-308">
            Manage your entire photo event in one place.
          </h1>

          <div className="mt-6 flex items-start gap-4 md:mt-7 lg:mt-8 animate-hero-fade-in [animation-delay:250ms]">
            <p className="max-w-xl text-center text-base leading-relaxed text-white/80 sm:text-left md:text-lg lg:max-w-[55%] lg:text-xl xl:max-w-xl xl:text-2xl">
              Blikka takes care of the tech behind the scenes, from photo uploads to judging, so you can focus on running the event.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-start md:mt-9 lg:mt-10 animate-hero-fade-in [animation-delay:350ms]">
            <Link
              href="#pricing"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-7 py-3.5 text-sm font-medium text-brand-white transition-[background-color,gap] duration-200 hover:gap-3 hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70 sm:w-auto sm:justify-start"
            >
              Book a demo
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70 sm:w-auto sm:justify-start"
            >
              See how it works
            </Link>
          </div>

          {/* Mobile-only upcoming event pill */}
          <div className="mt-5 lg:hidden animate-hero-fade-in [animation-delay:450ms]">
            <Link
              href="https://billetto.se/e/stockholm-fotomaraton-2026-biljetter-1361256"
              className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
            >
              <Ticket className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
              Stockholm Fotomaraton 2026 — tickets available
              <ArrowRight className="h-3 w-3 opacity-60" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
