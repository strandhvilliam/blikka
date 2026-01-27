"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { cn } from "@/lib/utils";
import { CheckCircle, CloudUpload } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { usePhotoContext } from "../_lib/photo-context";

interface UploadSectionProps {
  maxPhotos: number;
  onUploadClick: () => void;
}

export function UploadSection({ maxPhotos, onUploadClick }: UploadSectionProps) {
  const t = useTranslations("FlowPage.uploadStep");
  const { photos } = usePhotoContext();

  const allPhotosSelected = photos.length === maxPhotos && photos.length > 0;
  const isDisabled = photos.length >= maxPhotos;

  if (allPhotosSelected) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-2 border-dashed border-green-300 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="relative">
              <CloudUpload className="w-16 h-16 text-green-600" />
              <div className="absolute -top-1 -right-1 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-green-800 dark:text-green-200">
                {t("allPhotosSelected")}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {t("readyToSubmit", { count: maxPhotos })}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors cursor-pointer",
        isDisabled
          ? "opacity-50 pointer-events-none"
          : "hover:border-primary hover:bg-muted/50",
      )}
      onClick={onUploadClick}
    >
      <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
        <PrimaryButton
          className="rounded-full p-4 h-auto"
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onUploadClick();
          }}
        >
          <CloudUpload className="w-8 h-8" />
        </PrimaryButton>
        <div className="text-center">
          <p className="text-muted-foreground">{t("clickToSelect")}</p>
          <p className="text-sm text-muted-foreground">
            {t("photoCount", { current: photos.length, max: maxPhotos })}
          </p>
        </div>
        <PrimaryButton disabled={isDisabled}>{t("selectPhotos")}</PrimaryButton>
      </CardContent>
    </Card>
  );
}
