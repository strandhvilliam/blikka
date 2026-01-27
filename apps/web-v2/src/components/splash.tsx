"use client"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"

export function Splash({ className }: SplashProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background",
        className
      )}
    >
      <span className="sr-only">Loading</span>
      <motion.div
        initial={{ opacity: 0, scale: 0.995 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative flex items-center justify-center"
      >
        <motion.div
          aria-hidden="true"
          className="absolute h-64 w-64 rounded-full bg-foreground/5 blur-3xl"
          animate={{ scale: [0.92, 1.05, 0.92], opacity: [0.3, 0.6, 0.3] }}
          transition={{
            duration: 2.4,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute h-40 w-40 rounded-full border border-foreground/10"
          animate={{ scale: [1, 1.08, 1], opacity: [0.25, 0.6, 0.25] }}
          transition={{
            duration: 2.2,
            ease: "easeInOut",
            repeat: Infinity,
            delay: 0.2,
          }}
        />
        <motion.img
          src="/blikka-logo.svg"
          alt="Blikka logo"
          className="relative w-32 sm:w-36 md:w-40 h-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: [6, -4, 6], scale: [0.98, 1.02, 0.98] }}
          transition={{
            duration: 1.8,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      </motion.div>
    </div>
  )
}

interface SplashProps {
  className?: string
}
