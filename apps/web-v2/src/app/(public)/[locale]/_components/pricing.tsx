"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import { FadeIn } from "./fade-in"

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for trying out blikka with a small event.",
    features: [
      "1 active event",
      "Up to 100 uploads",
      "Basic gallery",
      "Email support",
    ],
    cta: "Get started free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/event",
    description: "For organizers running serious competitions.",
    features: [
      "Unlimited events",
      "Up to 2,000 uploads per event",
      "Judging & voting tools",
      "Custom branding",
      "Priority support",
      "Export & embed galleries",
    ],
    cta: "Start with Pro",
    featured: true,
  },
  {
    name: "Organization",
    price: "$99",
    period: "/month",
    description: "For teams and recurring event series.",
    features: [
      "Everything in Pro",
      "Unlimited uploads",
      "Team management",
      "API access",
      "Advanced analytics",
      "Dedicated account manager",
    ],
    cta: "Contact sales",
    featured: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border px-6 py-24 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-20 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
              Pricing
            </p>
            <h2 className="text-balance text-3xl leading-snug font-normal tracking-tight text-foreground lg:text-[2.75rem] lg:leading-[1.2]">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
              Start free, upgrade when you need more. No hidden fees.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <FadeIn key={plan.name} delay={index * 150}>
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-8 lg:p-10 ${plan.featured
                    ? "border-brand-primary bg-brand-black text-brand-white"
                    : "border-border bg-card text-card-foreground"
                  }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-8 rounded-full bg-brand-primary px-4 py-1 text-xs font-medium text-brand-white">
                    Most popular
                  </span>
                )}

                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className={`text-sm ${plan.featured ? "text-brand-white/50" : "text-muted-foreground"}`}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className={`mt-3 text-sm ${plan.featured ? "text-brand-white/60" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>

                <ul className="mt-8 flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-brand-primary" />
                      <span className={plan.featured ? "text-brand-white/80" : "text-foreground/80"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="#"
                  className={`mt-auto block rounded-full py-3.5 text-center text-sm font-medium transition-all ${plan.featured
                      ? "mt-10 bg-brand-primary text-brand-white hover:bg-brand-primary/90"
                      : "mt-10 border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
