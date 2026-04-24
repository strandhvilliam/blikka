"use client"

import Image from "next/image"
import { FadeIn } from "./fade-in"

type AudienceRow = {
  title: string
  description: string
  detail: string
  image: string
  alt: string
}

const audiences: AudienceRow[] = [
  {
    title: "Photomarathons",
    description:
      "Run timed categories, high upload volume, and winner selection without juggling folders, spreadsheets, and manual checks.",
    detail: "Best for day-long competitions with deadlines, judges, and public results.",
    image: "/photo-event-4.jpg",
    alt: "Crowd at a large photography event",
  },
  {
    title: "Camera Clubs & Associations",
    description:
      "Collect themed submissions, manage member participation, and keep judging rounds organized from one place.",
    detail: "Useful for recurring competitions, seasonal challenges, and club showcases.",
    image: "/photo-event-1.jpg",
    alt: "Photographers reviewing images together",
  },
  {
    title: "Schools, Festivals & Workshops",
    description:
      "Give participants a simple upload flow while your team keeps track of classes, categories, deadlines, and approvals.",
    detail: "Works well for education programs, cultural festivals, and guided photo events.",
    image: "/photo-event-6.jpg",
    alt: "Workshop setting with participants learning photography",
  },
]

export function WhoItsFor() {
  return (
    <section
      id="who-its-for"
      className="scroll-mt-28 border-t border-border bg-background px-6 py-24 md:px-10 md:py-28 lg:px-12 lg:scroll-mt-32 lg:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 lg:mb-20">
          <FadeIn>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
              Who It&apos;s For
            </p>
            <h2 className="font-gothic max-w-2xl text-balance text-3xl leading-snug font-normal tracking-tight text-foreground md:text-4xl lg:text-[2.85rem] lg:leading-[1.15]">
              Built for organizers who need more than an upload folder
            </h2>
          </FadeIn>
        </div>

        <div className="flex flex-col gap-20 lg:gap-28">
          {audiences.map((audience, index) => {
            const isReversed = index % 2 !== 0
            return (
              <FadeIn key={audience.title} delay={index * 80}>
                <div
                  className={`grid items-center gap-8 md:grid-cols-2 md:gap-10 lg:gap-16 ${isReversed ? "md:[direction:rtl]" : ""}`}
                >
                  <div className={isReversed ? "md:[direction:ltr]" : ""}>
                    <div className="relative aspect-3/2 overflow-hidden rounded-2xl md:aspect-4/3">
                      <Image
                        src={audience.image}
                        alt={audience.alt}
                        fill
                        className="object-cover scale-110 transition-transform duration-700 hover:scale-[1.03]"
                      />
                    </div>
                  </div>

                  <div className={isReversed ? "md:[direction:ltr]" : ""}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">
                      Use Case {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-4 text-2xl leading-tight font-semibold text-foreground lg:text-3xl">
                      {audience.title}
                    </h3>
                    <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                      {audience.description}
                    </p>
                    <p className="mt-5 border-t border-border pt-5 text-sm leading-relaxed text-foreground/70">
                      {audience.detail}
                    </p>
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}
