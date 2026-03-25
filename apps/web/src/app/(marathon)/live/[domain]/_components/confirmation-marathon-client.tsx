"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { ArrowRight, Check, Clock, MoreVertical, Recycle } from "lucide-react"
import { Icon } from "@iconify/react"

import { PrimaryButton } from "@/components/ui/primary-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { ConfirmationDetailsDialog } from "./confirmation-details-dialog"

export interface ConfirmationImage {
  imageUrl: string | undefined
  name: string
  orderIndex: number
}

interface ConfirmationMarathonClientProps {
  params: {
    participantRef: string
    participantFirstName: string
    participantLastName: string
  }
  participant: {
    reference: string
    deviceGroup?: { name: string } | null
    competitionClass?: { name: string } | null
  }
  images: ConfirmationImage[]
  submissionsCount: number
  handleRedirect: () => void
}

export function ConfirmationMarathonClient({
  params,
  participant,
  images,
  submissionsCount,
  handleRedirect,
}: ConfirmationMarathonClientProps) {
  const t = useTranslations("ConfirmationPage")
  const [selectedImage, setSelectedImage] = useState<ConfirmationImage | null>(null)
  return (
    <div className="mx-auto flex min-h-dvh max-w-[540px] flex-col px-6 py-8">
      {/* Header Menu */}
      <div className="absolute top-3 right-3 z-10 md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">{t("menu")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <button onClick={handleRedirect}>
                <Recycle className="h-4 w-4" />
                {t("startAgain")}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AnimatePresence mode="sync">
        {/* Success Header */}
        <motion.div
          key="confirmation"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="flex flex-col items-center pt-10"
        >
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 180, damping: 14 }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600"
            >
              <Check className="h-10 w-10 text-white" strokeWidth={3} />
            </motion.div>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.035, 1], opacity: [1, 0.72, 1] }}
              transition={{ delay: 0.4, duration: 3.8, ease: "easeInOut", repeat: Infinity }}
              className="absolute inset-0 scale-[1.35] rounded-full border-2 border-emerald-600/30"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.025, 1], opacity: [1, 0.7, 1] }}
              transition={{ delay: 0.75, duration: 4.6, ease: "easeInOut", repeat: Infinity }}
              className="absolute inset-0 scale-[1.7] rounded-full border border-emerald-600/15"
            />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 font-gothic text-3xl font-medium tracking-tight text-foreground"
          >
            {t("congratulations")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-2 text-sm text-muted-foreground"
          >
            {t("photosUploaded", { count: submissionsCount })}
          </motion.p>
        </motion.div>

        {/* Participant credential card */}
        <motion.div
          key="participant-info"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5, type: "spring", stiffness: 200, damping: 24 }}
          className="mt-8"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="px-4 py-4">
              <p className="truncate text-sm font-semibold text-foreground">
                {params.participantFirstName} {params.participantLastName}
              </p>
              <p className="mt-0.5 font-mono text-2xl font-bold tracking-wider text-foreground">
                #{participant.reference}
              </p>
            </div>

            {/* Tags */}
            {(participant.deviceGroup?.name || participant.competitionClass?.name) && (
              <div className="flex flex-wrap gap-2 border-t border-dashed border-border px-4 py-3">
                {participant.deviceGroup?.name && (
                  <span className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Icon icon="solar:bookmark-broken" className="h-3 w-3" />
                    {participant.deviceGroup.name}
                  </span>
                )}
                {participant.competitionClass?.name && (
                  <span className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Icon icon="solar:camera-minimalistic-broken" className="h-3 w-3" />
                    {participant.competitionClass.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Photo Grid */}
        {images.length > 0 && (
          <motion.div
            key="photos"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-5"
          >
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("yourPhotos")}
            </p>
            <motion.div
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.06 } },
              }}
              initial="hidden"
              animate="show"
              className="grid grid-cols-4 gap-2"
            >
              {images.map((image) => (
                <motion.div
                  key={image.orderIndex}
                  variants={{
                    hidden: { opacity: 0, scale: 0.92 },
                    show: { opacity: 1, scale: 1 },
                  }}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border bg-muted"
                  onClick={() => setSelectedImage(image)}
                >
                  {image.imageUrl ? (
                    <img
                      src={image.imageUrl}
                      alt={image.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-xs text-muted-foreground">—</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/20" />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-[10px] font-medium text-white drop-shadow-sm">
                      {image.name}
                    </p>
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <ArrowRight className="h-3 w-3 text-white" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* What's Next */}
        <motion.div
          key="next-steps"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="mt-5"
        >
          <div className="rounded-2xl border border-border bg-muted/30 px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("whatsNext")}
            </p>
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground">
                    {step}
                  </span>
                  <p className="text-sm leading-snug text-foreground">
                    {step === 3
                      ? t("steps.3", { juryDate: "31/8", resultsDate: "1/9" })
                      : step === 4
                        ? t("steps.4", { prizeDate: "20/8" })
                        : t(`steps.${step}`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <ConfirmationDetailsDialog
        image={{
          imageUrl: selectedImage?.imageUrl,
          name: selectedImage?.name ?? "",
          orderIndex: selectedImage?.orderIndex ?? 0,
        }}
        open={!!selectedImage}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      />
    </div>
  )
}
