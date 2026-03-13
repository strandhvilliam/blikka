"use client"

import { FadeIn } from "./fade-in"

const testimonials = [
  {
    quote:
      "The amount of administrative work for the upload process is reduced by a lot. It's a big help when you have a lot of participants and a lot of entries to manage.",
    name: "Emil Gyllenberg",
    role: "Stockholm Fotomaraton, Co-owner",
  },
  {
    quote:
      "Blikka has made our photo competition so much easier to manage. The upload process is seamless, and the judging process is simple and efficient. It's been a pleasure being part of the development.",
    name: "Gabriel Modéus",
    role: "Stockholm Fotomaraton, Co-owner",
  },
  {
    quote:
      "Our participants love how easy it is to upload. The mobile participant flow is a big improvement.",
    name: "Deeped Strandh",
    role: "Stockholm Fotomaraton, Co-owner",
  },
]

export function SocialProof() {
  return (
    <section className="border-t border-border bg-brand-black px-6 py-24 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-primary">
            Trusted by organizers
          </p>
          <h2 className="font-gothic max-w-2xl text-balance text-3xl leading-snug font-normal tracking-tight text-brand-white lg:text-[2.75rem] lg:leading-[1.2]">
            Hear from the people who use blikka
          </h2>
        </FadeIn>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-brand-white/10 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <FadeIn key={testimonial.name} delay={index * 150}>
              <div className="flex h-full flex-col justify-between bg-brand-white/5 p-8 lg:p-10">
                <blockquote className="text-base leading-relaxed text-brand-white/80 lg:text-lg">
                  {`"${testimonial.quote}"`}
                </blockquote>
                <div className="mt-8 border-t border-brand-white/10 pt-6">
                  <p className="font-semibold text-brand-white">{testimonial.name}</p>
                  <p className="mt-1 text-xs text-brand-white/40">{testimonial.role}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
