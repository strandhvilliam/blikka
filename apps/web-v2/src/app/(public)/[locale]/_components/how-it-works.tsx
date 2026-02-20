"use client"

import Image from "next/image"
import { FadeIn } from "./fade-in"
import { eventImages } from "./landing-images"

const cards = [
  {
    type: "image" as const,
    image: eventImages.photoEvent4,
    text: "Set up your competition in minutes. Define categories, deadlines, and branding.",
  },
  {
    type: "image" as const,
    image: eventImages.photoEvent6,
    text: "Share your branded upload link. Participants upload from any device, zero friction.",
  },
  {
    type: "accent" as const,
    title: "Collect, judge, celebrate.",
    text: "Watch entries flow in. Use built-in judging tools or open up public voting.",
  },
  {
    type: "image" as const,
    image: eventImages.photoEvent8,
    text: "Announce results, share galleries, and celebrate the best work.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border px-6 py-24 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-6xl">
        {/* Two-column header like screenshot 3 */}
        <div className="mb-20 flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <FadeIn>
            <div className="max-w-xs">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
                How it works
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                From setup to showcase, every step is crafted to simplify the process and amplify your event{"'"}s impact.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <h2 className="max-w-2xl text-balance text-3xl leading-snug font-normal tracking-tight text-foreground lg:text-[2.75rem] lg:leading-[1.2]">
              Built for clarity and flow, our process{" "}
              <span className="bg-brand-primary/20 px-1 text-foreground">
                gives organizers room to breathe
              </span>{" "}
              — so you can focus on creating, scaling, and standing out.
            </h2>
          </FadeIn>
        </div>

        {/* 4-column card grid like screenshot 3 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, index) => (
            <FadeIn key={index} delay={index * 100}>
              {card.type === "accent" ? (
                <div className="flex flex-col justify-between rounded-2xl bg-brand-primary p-6 text-brand-white" style={{ minHeight: "360px" }}>
                  <h3 className="text-2xl leading-tight font-normal">
                    {card.title}
                  </h3>
                  <p className="mt-auto text-sm leading-relaxed text-brand-white/80">
                    {card.text}
                  </p>
                </div>
              ) : (
                <div className="group">
                  <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: "360px" }}>
                    <Image
                      src={card.image!}
                      alt={card.text}
                      fill
                      className="object-cover grayscale transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                    />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {card.text}
                  </p>
                </div>
              )}
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
