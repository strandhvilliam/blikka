"use client"

import { useTranslations } from "next-intl"
import { CompetitionClass } from "@blikka/db"
import { cn } from "@/lib/utils"
import { CheckCircle2 } from "lucide-react"
import { motion } from "motion/react"

export function ClassSelectionItem({
  competitionClass,
  isSelected,
  onSelect,
}: {
  competitionClass: CompetitionClass
  isSelected: boolean
  onSelect: () => void
}) {
  const t = useTranslations("FlowPage")

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
      {/* Photo count badge */}
      <motion.div
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl",
          isSelected ? "bg-foreground/5" : "bg-muted/50",
        )}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <motion.span
          className={cn(
            "text-3xl font-bold",
            isSelected ? "text-foreground" : "text-foreground/70",
          )}
          layout
          transition={{ duration: 0.2 }}
        >
          {competitionClass.numberOfPhotos}
        </motion.span>
      </motion.div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold leading-tight text-foreground">
            {competitionClass.name}
          </p>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: isSelected ? 1 : 0, opacity: isSelected ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <CheckCircle2 className="h-5 w-5 text-foreground" />
          </motion.div>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {competitionClass.numberOfPhotos === 1
            ? "1 photo"
            : `${t("classSelection.numberOfPhotos")}: ${competitionClass.numberOfPhotos}`}
        </p>
        {competitionClass.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {competitionClass.description}
          </p>
        )}
      </div>
    </motion.button>
  )
}
