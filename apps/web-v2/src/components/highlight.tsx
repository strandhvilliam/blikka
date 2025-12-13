"use client"

import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import React from "react"

export function Highlight({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.span
      initial={{
        backgroundSize: "0% 100%",
      }}
      animate={{
        backgroundSize: "100% 100%",
      }}
      transition={{
        duration: 0.2,
        ease: "linear",
        delay: 0.5,
      }}
      style={{
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left center",
        display: "inline",
      }}
      className={cn(
        `relative inline-block pb-1 px-1 rounded-lg bg-linear-to-r from-pomegranate-300 to-pomegranate-300 dark:from-pomegranate-500 dark:to-pomegranate-500`,
        className
      )}
    >
      {children}
    </motion.span>
  )
}
