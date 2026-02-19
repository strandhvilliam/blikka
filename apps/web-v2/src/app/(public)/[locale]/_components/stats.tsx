"use client"

import { FadeIn } from "./fade-in"

const stats = [
  { value: "12k+", label: "Photos uploaded" },
  { value: "340+", label: "Events hosted" },
  { value: "98%", label: "Organizer satisfaction" },
  { value: "45+", label: "Countries reached" },
]

export function Stats() {
  return (
    <section className="px-6 py-16 lg:px-12 lg:py-20">
      <FadeIn>
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-12">
            {stats.map((stat, index) => (
              <FadeIn key={stat.label} delay={index * 0.1}>
                <div className="flex flex-col">
                  <p className="font-mono text-4xl font-bold text-foreground lg:text-5xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  )
}
