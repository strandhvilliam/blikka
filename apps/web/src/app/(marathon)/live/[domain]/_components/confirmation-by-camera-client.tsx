"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { Check, Clock, MoreVertical, Recycle, Vote } from "lucide-react"
import { Icon } from "@iconify/react"

import { PrimaryButton } from "@/components/ui/primary-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { ConfirmationImage } from "./confirmation-marathon-client"

interface ConfirmationByCameraClientProps {
  params: {
    participantRef: string
    participantFirstName: string
    participantLastName: string
  }
  participant: {
    reference: string
    deviceGroup?: { name: string; icon: string } | null
    competitionClass?: { name: string } | null
  }
  image: ConfirmationImage | null
  handleRedirect: () => void
  remainingSeconds: number
  addSeconds: (seconds: number) => void
}

export function ConfirmationByCameraClient({
  params,
  participant,
  image,
  handleRedirect,
  remainingSeconds,
  addSeconds,
}: ConfirmationByCameraClientProps) {
  const t = useTranslations("ConfirmationPage")
  const [previewImage, setPreviewImage] = useState<{
    imageUrl: string
    name: string
  } | null>(null)

  const openPreview = () => {
    if (image?.imageUrl) {
      setPreviewImage({ imageUrl: image.imageUrl, name: image.name })
    }
  }

  return (
    <div className="min-h-dvh px-5 py-8 max-w-[540px] mx-auto flex flex-col">
      {/* Header Menu */}
      <div className="md:hidden absolute top-3 right-3 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 text-muted-foreground"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">{t("menu")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <button onClick={handleRedirect}>
                <Recycle className="w-4 h-4" />
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
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="flex flex-col items-center pt-10"
        >
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 180, damping: 14 }}
              className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center"
            >
              <Check className="h-10 w-10 text-white" strokeWidth={3} />
            </motion.div>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border-2 border-emerald-600/30 scale-[1.35]"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-emerald-600/15 scale-[1.7]"
            />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-gothic font-semibold text-foreground mt-10 tracking-tight"
          >
            {t("congratulations")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground text-sm mt-1"
          >
            {t("photoUploaded")}
          </motion.p>
        </motion.div>

        {/* Photo Card */}
        <motion.div
          key="photo-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6"
        >
          <div
            className="rounded-2xl border border-border bg-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200"
            onClick={openPreview}
          >
            <div className="w-full max-h-[200px] min-h-[120px] flex items-center justify-center overflow-hidden bg-stone-50">
              {image?.imageUrl ? (
                <img
                  src={image.imageUrl}
                  alt={image.name}
                  className="block max-w-full max-h-[200px] object-contain"
                />
              ) : (
                <div className="w-full min-h-[120px] flex items-center justify-center">
                  <Icon
                    icon="solar:camera-minimalistic-broken"
                    className="w-12 h-12 text-stone-300"
                  />
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-border/60">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate text-sm">
                    {params.participantFirstName} {params.participantLastName}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    #{participant.reference}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {participant.deviceGroup?.name && (
                    <span className="text-[11px] text-stone-700 flex items-center gap-1 bg-stone-100 border border-stone-200/60 px-2 py-0.5 rounded-md font-medium">
                      <Icon
                        icon={
                          participant.deviceGroup.icon === "smartphone"
                            ? "solar:smartphone-broken"
                            : "solar:camera-minimalistic-broken"
                        }
                        className="w-3 h-3"
                      />
                      {participant.deviceGroup.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Desktop Action Buttons */}
        <motion.div
          key="restart"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="hidden md:flex gap-3 mt-6"
        >
          <PrimaryButton onClick={handleRedirect} className="flex-1 py-3 text-base rounded-full">
            {t("newParticipant")}
            <span className="text-white/80 text-sm ml-2">
              {t("secondsSuffix", { seconds: remainingSeconds })}
            </span>
          </PrimaryButton>
          <Button
            variant="outline"
            className="rounded-full text-base px-6 py-3 h-auto"
            onClick={() => addSeconds(30)}
          >
            <Clock className="w-4 h-4 mr-2" />
            {t("waitSeconds", { seconds: 30 })}
          </Button>
        </motion.div>

        {/* Voting Info */}
        <motion.div
          key="voting-info"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-5"
        >
          <div className="rounded-xl border border-border bg-stone-50/60 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 bg-white border border-border rounded-lg flex items-center justify-center shadow-sm">
                <Vote className="h-4 w-4 text-stone-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">{t("votingTitle")}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                  {t("votingMessage")}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Full Page Image Preview */}
      {previewImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage.imageUrl}
              alt={previewImage.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute -bottom-10 left-0 right-0 text-center">
              <p className="text-white/70 text-sm">{previewImage.name}</p>
            </div>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-11 right-0 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <Icon icon="solar:close-circle-broken" className="w-5 h-5 text-white" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
