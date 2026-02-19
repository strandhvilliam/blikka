"use client"

import { FadeIn } from "./fade-in"

const testimonials = [
  {
    quote:
      "We used to collect entries via email. It was a nightmare. Blikka made our annual photo walk competition feel professional and effortless.",
    name: "Sara Lindqvist",
    role: "Stockholm Photo Festival",
  },
  {
    quote:
      "The judging tools are brilliant. We had 8 judges across 3 countries scoring 600 entries, and it just worked.",
    name: "Marcus Chen",
    role: "Aperture Awards",
  },
  {
    quote:
      "Our participants love how easy it is to upload. We saw a 40% increase in entries after switching to blikka.",
    name: "Emilia Rossi",
    role: "Urban Lens Collective",
  },
]

export function SocialProof() {
  return (
    <section className="border-t border-border bg-foreground px-6 py-24 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">
            Trusted by organizers
          </p>
          <h2 className="max-w-2xl text-balance text-3xl leading-snug font-normal tracking-tight text-background lg:text-[2.75rem] lg:leading-[1.2]">
            Hear from the community
          </h2>
        </FadeIn>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-background/10 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <FadeIn key={testimonial.name} delay={index * 150}>
              <div className="flex h-full flex-col justify-between bg-background/5 p-8 lg:p-10">
                <blockquote className="text-base leading-relaxed text-background/80 lg:text-lg">
                  {`"${testimonial.quote}"`}
                </blockquote>
                <div className="mt-8 border-t border-background/10 pt-6">
                  <p className="font-semibold text-background">{testimonial.name}</p>
                  <p className="mt-1 text-xs text-background/40">{testimonial.role}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
