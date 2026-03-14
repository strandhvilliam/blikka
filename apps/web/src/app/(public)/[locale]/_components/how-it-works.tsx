"use client"

import { FadeIn } from "./fade-in"

type WorkflowStep = {
  step: string
  title: string
  description: string
}

const steps: WorkflowStep[] = [
  {
    step: "01",
    title: "Set Up Your Event",
    description:
      "Define categories, deadlines, participant rules, and event branding before submissions open.",
  },
  {
    step: "02",
    title: "Share The Upload Link",
    description:
      "Participants submit directly from any device through a branded upload flow built for mobile.",
  },
  {
    step: "03",
    title: "Review And Judge",
    description:
      "Track incoming submissions, flag problems early, and invite judges into a structured scoring workflow.",
  },
  {
    step: "04",
    title: "Publish Results",
    description:
      "Move from selected winners to a polished showcase without rebuilding the event story somewhere else.",
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-28 px-6 py-24 md:px-10 md:py-28 lg:px-12 lg:scroll-mt-32 lg:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 flex flex-col gap-6 md:mb-18 md:flex-row md:items-end md:justify-between lg:mb-20">
          <FadeIn>
            <div className="max-w-md">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
                How It Works
              </p>
              <h2 className="font-gothic text-balance text-3xl leading-snug font-normal tracking-tight text-foreground md:text-4xl lg:text-[2.85rem] lg:leading-[1.15]">
                Four steps from setup to published winners
              </h2>
            </div>
          </FadeIn>
          <FadeIn delay={150}>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-right">
              Each stage gives organizers a concrete handoff so the event does not fall back into
              manual admin halfway through.
            </p>
          </FadeIn>
        </div>

        <div className="relative grid gap-0 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <FadeIn key={step.step} delay={index * 100}>
              <div className="group relative pb-10 pl-10 sm:pb-12 lg:pb-0 lg:pl-0 lg:pr-8">
                <div className="absolute top-0 left-0 flex h-full w-px flex-col items-center lg:relative lg:mb-6 lg:h-auto lg:w-full lg:flex-row">
                  <div className="relative z-10 flex h-13 w-13 shrink-0 items-center justify-center rounded-full border-2 border-brand-primary/30 bg-background text-lg font-semibold text-brand-primary transition-colors duration-300 group-hover:border-brand-primary group-hover:bg-brand-primary/5 lg:static">
                    {step.step}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="h-full w-px bg-border lg:h-px lg:w-full" />
                  )}
                </div>

                <div className="lg:mt-0">
                  <h3 className="text-lg leading-tight font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
