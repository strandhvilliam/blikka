"use client"

import Image from "next/image"
import { FadeIn } from "./fade-in"
import { eventImages } from "./landing-images"

export function Gallery() {
  return (
    <section id="gallery" className="px-6 py-24 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <h2 className="font-gothic mx-auto max-w-4xl text-center text-3xl leading-snug font-normal tracking-tight text-foreground lg:text-[3.25rem] lg:leading-[1.15]">
            Armed with smart upload tools and seamless workflows, blikka collects, organizes, and{" "}
            <span className="bg-brand-primary/60 px-1 text-foreground">
              showcases with precision
            </span>{" "}
            — keeping your event in control at every step.
          </h2>
        </FadeIn>

        <div className="mt-16 grid gap-4 lg:mt-24 lg:grid-cols-2">
          <FadeIn delay={100}>
            <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl">
              <Image
                src={eventImages.photoEvent1}
                alt="Photo competition entry"
                fill
                className="object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
              />
            </div>
          </FadeIn>
          <FadeIn delay={250}>
            <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl">
              <Image
                src={eventImages.photoEvent2}
                alt="Photo competition showcase"
                fill
                className="object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
              />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
