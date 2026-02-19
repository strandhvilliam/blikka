import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { NoiseOverlay } from "./noise-overlay"

export function Hero() {
  return (
    <div className="bg-background p-3 lg:p-4">
      <section className="relative flex min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl lg:min-h-[calc(100vh-2rem)] lg:rounded-3xl">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/blikka-hero2.jpg"
            alt="Photographer with vintage camera in black and white"
            fill
            className="rounded-2xl object-cover lg:rounded-3xl"
            priority
            quality={100}
          />
          {/* Layered overlays for depth */}
          <div className="absolute inset-0 rounded-2xl bg-black/10 lg:rounded-3xl" />
          <NoiseOverlay />
          {/* <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/90 via-black/20 to-transparent lg:rounded-3xl" /> */}
          {/* <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-black/60 via-transparent to-transparent lg:rounded-3xl" /> */}
        </div>

        {/* Top-right floating info card */}
        <div className="absolute top-24 right-6 z-10 hidden max-w-[260px] rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-2xl lg:block">
          <div className="mb-3 h-px w-8 bg-primary" />
          <p className="text-[13px] leading-relaxed font-medium text-white/90">
            We saw how messy photo competitions could be. So we built something better.
          </p>
        </div>

        {/* Content area - bottom aligned */}
        <div className="relative z-10 mt-auto flex w-full flex-col px-6 pb-12 pt-48 lg:px-12 lg:pb-16">
          {/* Oversized brand name */}
          <h1 className="font-bold -ml-4 text-[clamp(4.5rem,18vw,14rem)] leading-[0.8] tracking-tighter text-white">
            blikka
          </h1>

          {/* Tagline with accent line */}
          <div className="mt-6 flex items-start gap-4 lg:mt-8">
            <p className="max-w-xl text-base leading-relaxed text-white/70 lg:max-w-2xl lg:text-lg">
              The simplest way to collect and showcase photo competition entries.
              Built for organizers who care about the creative experience.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center lg:mt-10">
            <Link
              href="#"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-all hover:gap-3"
            >
              Start your first event
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
