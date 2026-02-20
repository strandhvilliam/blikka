"use client"

import { FadeIn } from "./fade-in"

const stats = [
  { value: "10,000+", label: "Photos uploaded" },
  { value: "800+", label: "Participants served" },
]

export function Stats() {
  return (
    <section className="px-6 py-16 lg:px-12 lg:py-20">
      <FadeIn>
        <div className="mx-auto max-w-7xl ">
          <div className="gap-32 flex justify-center">
            {stats.map((stat, index) => (
              <FadeIn key={stat.label} delay={index * 0.1}>
                <div className="flex flex-col">
                  <p className="font-mono text-4xl font-bold text-foreground lg:text-6xl">
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
