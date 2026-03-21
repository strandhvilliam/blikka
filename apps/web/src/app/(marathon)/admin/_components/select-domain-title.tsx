"use client"

import { motion } from "motion/react"

export function SelectDomainTitle() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-brand-black/10 bg-brand-black/3 px-3 py-1">
        <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-black/50">
          Organizer portal
        </span>
      </div>
      <h1 className="mt-4 font-gothic font-medium text-4xl leading-[0.92] tracking-tight text-brand-black md:text-5xl">
        Select your marathon.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-brand-black/55">
        Choose a marathon to manage from your dashboard.
      </p>
    </motion.div>
  )
}
