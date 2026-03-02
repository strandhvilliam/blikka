"use client"

import { motion } from "motion/react"
import { Highlight } from "@/components/highlight"

export function StaffSelectDomainTitle() {
  return (
    <motion.h1
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: [20, -5, 0] }}
      transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
      className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 max-w-4xl leading-relaxed lg:leading-snug text-center mx-auto z-10 font-rocgrotesk"
    >
      Select a <Highlight className="text-black">marathon</Highlight> for the staff desk
    </motion.h1>
  )
}
