"use client"

import Image from "next/image"
import { FadeIn } from "./fade-in"

const testimonials = [
  {
    quote:
      "The amount of administrative work around uploads is reduced by a lot. That matters when you have a large participant base and a lot of entries to manage.",
    name: "Emil Gyllenberg",
    role: "Co-owner, Stockholm Fotomaraton",
  },
  {
    quote:
      "Our participants notice the difference immediately. The mobile upload flow is a big improvement over the older process.",
    name: "Deeped Strandh",
    role: "Co-owner, Stockholm Fotomaraton",
  },
]

const metrics = [
  { value: "10,000+", label: "Photos managed" },
  { value: "800+", label: "Participants served" },
]

export function SocialProof() {
  return (
    <section className="border-t border-border bg-background px-6 py-24 md:px-10 md:py-28 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
            Trusted By Real Organizers
          </p>
        </FadeIn>

        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] md:gap-8">
          <FadeIn delay={80}>
            <div className="relative aspect-4/3 overflow-hidden rounded-2xl md:aspect-auto md:h-full md:min-h-[420px] lg:min-h-[520px]">
              <Image
                src="/photo-event-5.jpg"
                alt="Photographer capturing a moment at an event"
                fill
                className="object-cover scale-110"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex gap-3">
                  {metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-xl border border-white/15 bg-black/50 px-4 py-3 backdrop-blur-md"
                    >
                      <p className="font-gothic text-2xl leading-none tracking-tight text-white lg:text-[1.75rem]">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/60">
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

          <div className="flex flex-col gap-6">
            {testimonials.map((testimonial, index) => (
              <FadeIn key={testimonial.name} delay={160 + index * 80}>
                <article className="flex flex-1 flex-col justify-between rounded-2xl border border-border bg-card p-8 lg:p-10">
                  <div>
                    <blockquote className="text-xl leading-relaxed text-foreground/90 lg:text-2xl lg:leading-relaxed">
                      &ldquo;{testimonial.quote}&rdquo;
                    </blockquote>
                  </div>
                  <div className="mt-8 flex items-center gap-4 border-t border-border pt-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/15 text-sm font-bold text-brand-primary">
                      {testimonial.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
