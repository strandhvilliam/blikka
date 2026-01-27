"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CloudUpload } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
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
          <Card className="border-2 border-dashed border-green-200 bg-green-50/50 backdrop-blur-sm rounded-lg p-8 mb-6 transition-colors">
            <CardContent className="flex flex-col items-center justify-center space-y-6 p-0">
              <div className="relative">
                <CloudUpload className="h-20 w-20 text-green-600" />
                <div className="absolute -top-2 -right-2 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center">
                  ✓
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-green-800">
                  {t("allPhotosSelected")}
                </p>
                <p className="text-sm text-green-700 max-w-md">
                  {t("readyToSubmit", { count: maxPhotos })}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : photos.length < maxPhotos ? (
        <motion.div
          key="upload-zone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className={cn(
              "border-2 border-dashed border-muted-foreground/40 bg-background/60 backdrop-blur-sm rounded-lg p-8 mb-6 transition-colors cursor-pointer hover:border-primary hover:bg-muted",
              isDisabled && "opacity-50 pointer-events-none",
            )}
            onClick={(e) => {
              e.preventDefault();
              onUploadClick();
            }}
          >
            <div className="text-center flex flex-col justify-center items-center">
              <PrimaryButton
                className="flex items-center justify-center p-4 rounded-full mb-4"
                disabled={isDisabled}
              >
                <CloudUpload className="w-10 h-10 text-white" />
              </PrimaryButton>

              <p className="text-muted-foreground mb-2">
                {t("clickToSelect")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("photoCount", { current: photos.length, max: maxPhotos })}
              </p>
              <PrimaryButton disabled={isDisabled} className="mt-4">
                {t("selectPhotos")}
              </PrimaryButton>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="loading-skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="border-2 border-dashed border-muted-foreground/40 bg-background/60 backdrop-blur-sm rounded-lg p-8 mb-6">
            <div className="text-center flex flex-col justify-center items-center">
              <Skeleton className="h-20 w-20 rounded-full mb-4" />
              <Skeleton className="h-5 w-64 mb-2" />
              <Skeleton className="h-4 w-40 mb-2" />
              <Skeleton className="h-4 w-20 mb-4" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
