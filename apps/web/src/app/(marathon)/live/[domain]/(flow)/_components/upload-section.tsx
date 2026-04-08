"use client"

import { PrimaryButton } from "@/components/ui/primary-button"
import { cn } from "@/lib/utils"
import { Check, CloudUpload, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "motion/react"
import { usePhotoStore } from "@/lib/flow/photo-store"

interface UploadSectionProps {
  maxPhotos: number
  onUploadClick: () => void
  isProcessingFiles: boolean
}

export function UploadSection({ maxPhotos, onUploadClick, isProcessingFiles }: UploadSectionProps) {
  const t = useTranslations("FlowPage.uploadStep")
  const photos = usePhotoStore((state) => state.photos)

  const allPhotosSelected = photos.length === maxPhotos && photos.length > 0
  const isDisabled = photos.length >= maxPhotos || isProcessingFiles

  return (
    <AnimatePresence mode="popLayout">
      {allPhotosSelected ? (
        <motion.div
          key="all-photos-selected"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 px-5 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600">
              <Check className="h-6 w-6 text-white" strokeWidth={3} />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">{t("allPhotosSelected")}</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                {t("readyToSubmit", { count: maxPhotos })}
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="upload-zone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className={cn(
              "flex flex-col items-center rounded-2xl border-2 border-dashed border-foreground/20 bg-white px-6 py-10 transition-all",
              !isDisabled && "cursor-pointer hover:border-foreground/40",
              isDisabled && "pointer-events-none opacity-50",
            )}
            onClick={(e) => {
              e.preventDefault()
              onUploadClick()
            }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/[0.06]">
              {isProcessingFiles ? (
                <Loader2 className="h-7 w-7 animate-spin text-foreground/50" />
              ) : (
                <CloudUpload className="h-7 w-7 text-foreground/50" />
              )}
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              {isProcessingFiles ? "Preparing previews..." : t("clickToSelect")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("photoCount", { current: photos.length, max: maxPhotos })}
            </p>
            <PrimaryButton disabled={isDisabled} className="mt-5 rounded-full px-8">
              {t("selectPhotos")}
            </PrimaryButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
