"use client"

import { motion } from "motion/react"

export function StaffSelectDomainTitle() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="z-10 text-center"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Staff desk
      </p>
      <h1 className="mt-2 font-gothic text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        Select a marathon
      </h1>
    </motion.div>
  )
}
