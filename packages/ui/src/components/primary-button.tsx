"use client"

import { motion } from "motion/react"
import { cn } from "../lib/utils"

export function PrimaryButton({
  className,
  children,
  disabled,
  onClick,
  type = "button",
  primaryColor = "#FF5D4B",
  secondaryColor = "#FE3923",
  hoverPrimaryColor = "#E32D18",
}: {
  className?: string
  children: React.ReactNode
  disabled?: boolean
  type?: "button" | "submit" | "reset"
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  primaryColor?: string
  secondaryColor?: string
  hoverPrimaryColor?: string
}) {
  const shadowColor = "rgba(254, 57, 35, 0.2)"
  const disabledGradientStart = "#9CA3AF"
  const disabledGradientEnd = "#6B7280"
  const disabledShadowColor = "rgba(156, 163, 175, 0.2)"

  return (
    <motion.button
      className={cn(
        "relative px-4 py-2 text-white text-sm font-semibold rounded-lg flex justify-center items-center gap-2 flex-row ",
        "transition-all duration-200 ease-in-out",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={
        {
          textShadow: "0px 2px 3px rgba(0, 0, 0, 0.2)",
          boxShadow: `0px 2px 8px ${disabled ? disabledShadowColor : shadowColor}`,
          "--gradient-start": disabled ? disabledGradientStart : primaryColor,
          "--gradient-end": disabled ? disabledGradientEnd : secondaryColor,
          background: "linear-gradient(180deg, var(--gradient-start) 0%, var(--gradient-end) 100%)",
        } as React.CSSProperties
      }
      whileHover={
        {
          "--gradient-start": disabled ? disabledGradientStart : hoverPrimaryColor,
          "--gradient-end": disabled ? disabledGradientEnd : primaryColor,
          boxShadow: `0px 6px 8px ${disabled ? disabledShadowColor : shadowColor}`,
        } as any
      }
      whileTap={{
        boxShadow: `0px 5px 10px ${disabled ? disabledShadowColor : shadowColor}`,
      }}
      transition={{
        duration: 0.2,
        ease: "easeInOut",
      }}
      disabled={disabled}
      type={type}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}
