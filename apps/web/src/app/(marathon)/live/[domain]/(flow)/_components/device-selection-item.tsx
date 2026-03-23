"use client"

import { DeviceGroup } from "@blikka/db"
import { cn } from "@/lib/utils"
import { CheckCircle2 } from "lucide-react"
import { motion } from "motion/react"
import { Icon } from "@iconify/react"

export function DeviceSelectionItem({
  deviceGroup,
  isSelected,
  onSelect,
}: {
  deviceGroup: DeviceGroup
  isSelected: boolean
  onSelect: () => void
}) {
  const getDeviceIcon = (icon: string) => {
    switch (icon) {
      case "smartphone":
        return "solar:smartphone-broken"
      case "camera":
      default:
        return "solar:camera-minimalistic-broken"
    }
  }

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border-2 bg-white px-4 py-3.5 text-left transition-all",
        isSelected
          ? "border-foreground shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
          : "border-border",
      )}
    >
      {/* Icon badge */}
      <motion.div
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl transition-colors",
          isSelected ? "bg-foreground/5" : "bg-muted/50",
        )}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Icon
          icon={getDeviceIcon(deviceGroup.icon)}
          className={cn(
            "h-10 w-10 -rotate-[5deg] transition-colors",
            isSelected ? "text-foreground" : "text-foreground/70",
          )}
        />
      </motion.div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground">{deviceGroup.name}</p>
        {deviceGroup.description && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {deviceGroup.description}
          </p>
        )}
      </div>

      {/* Check indicator */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: isSelected ? 1 : 0, opacity: isSelected ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <CheckCircle2 className="h-5 w-5 text-foreground" />
      </motion.div>
    </motion.button>
  )
}
