"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { FadeIn } from "./fade-in"

type FAQItem = {
  question: string
  answer: string
}

const items: FAQItem[] = [
  {
    question: "How does pricing work?",
    answer:
      "Pricing is scoped around your event format, expected participant volume, and how often you run events. The demo call ends with a recommended setup and a clear quote.",
  },
  {
    question: "Do participants need to install an app?",
    answer:
      "No. Participants use a branded upload link that works directly in the browser, which keeps the submission flow lightweight and easier to complete on mobile.",
  },
  {
    question: "How does judging work?",
    answer:
      "Organizers can review submissions centrally and invite judges by link. Judges score within the platform while submissions stay organized by participant, category, and event rules.",
  },
  {
    question: "Can the experience match our brand and event format?",
    answer:
      "Yes. The setup can be tailored around your categories, deadlines, and participant flow, and the upload experience can be branded to feel like part of your event rather than a generic tool.",
  },
  {
    question: "Is Blikka only for large events?",
    answer:
      "No. It works for smaller competitions too, especially when you want a cleaner participant experience and less manual admin work without building your own workflow.",
  },
  {
    question: "What does onboarding look like?",
    answer:
      "The first call maps your event format and operational needs. From there, the onboarding focuses on event setup, judging flow, and making sure the participant journey is ready before launch.",
  },
]

export function FAQ() {
  return (
    <section
      id="faq"
      className="scroll-mt-28 border-t border-border bg-background px-6 py-24 md:px-10 md:py-28 lg:px-12 lg:scroll-mt-32 lg:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] md:gap-12 lg:gap-16">
          <FadeIn>
            <div className="lg:top-32">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
                FAQ
              </p>
              <h2 className="font-gothic text-balance text-3xl leading-snug font-normal tracking-tight text-foreground md:text-[2rem] lg:text-[2.5rem] lg:leading-[1.15]">
                Answers before you book the call
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Common questions from organizers evaluating Blikka for their next event.
              </p>
              <Link
                href="#pricing"
                className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-brand-primary"
              >
                Still have questions? Book a demo
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <div className="rounded-2xl border border-border bg-card px-6 py-2 lg:px-8">
              <Accordion type="single" collapsible className="w-full">
                {items.map((item) => (
                  <AccordionItem
                    key={item.question}
                    value={item.question}
                    className="border-border data-[state=open]:border-brand-primary/20"
                  >
                    <AccordionTrigger className="py-5 text-left text-base leading-relaxed text-foreground transition-colors hover:no-underline data-[state=open]:text-brand-primary">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
