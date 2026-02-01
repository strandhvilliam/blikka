"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MoreVertical,
  Recycle,
  Trophy,
  Vote,
} from "lucide-react";
import { Icon } from "@iconify/react";

import { Card, CardContent } from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildS3Url, formatDomainPathname } from "@/lib/utils";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { useDesktopCountdownRedirect } from "@/hooks/use-desktop-countdown-redirect";

import { ConfirmationDetailsDialog } from "./confirmation-details-dialog";

const Confetti = dynamic(
  () => import("react-confetti").then((mod) => mod.default),
  {
    ssr: false,
  },
);

const THUMBNAILS_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME;
const PHOTOS_BUCKET = process.env.NEXT_PUBLIC_PHOTOS_BUCKET_NAME;

interface ConfirmationClientProps {
  params: {
    participantRef: string;
    participantFirstName: string;
    participantLastName: string;
  };
}

export function ConfirmationClient({ params }: ConfirmationClientProps) {
  const domain = useDomain();
  const trpc = useTRPC();
  const t = useTranslations("ConfirmationPage");
  const [selectedImage, setSelectedImage] = useState<{
    thumbnailUrl: string | undefined;
    name: string;
    orderIndex: number;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    imageUrl: string;
    name: string;
  } | null>(null);

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions({
      reference: params.participantRef ?? "",
      domain,
    }),
  );
  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  );
  const handleRedirect = () => {
    switch (marathon.mode) {
      case "marathon":
        window.location.replace(
          formatDomainPathname(`/live/marathon`, domain, "live"),
        );
        break;
      case "by-camera":
        window.location.replace(
          formatDomainPathname(`/live/by-camera`, domain, "live"),
        );
        break;
    }
  };

  const { remainingSeconds, addSeconds } = useDesktopCountdownRedirect({
    initialSeconds: 15,
    onRedirect: handleRedirect,
  });

  const submissions = participant?.publicSubmissions
    ? [...participant.publicSubmissions]
    : [];

  const images = submissions
    .sort((a, b) => (a.topic?.orderIndex ?? 0) - (b.topic?.orderIndex ?? 0))
    .map((submission) => {
      return {
        thumbnailUrl: buildS3Url(THUMBNAILS_BUCKET, submission.thumbnailKey),
        name: submission.topic?.name ?? t("photoPlaceholder") ?? "",
        orderIndex: submission.topic?.orderIndex ?? 0,
      };
    });

  return (
    <>
      <Confetti recycle={false} numberOfPieces={200} />
      <div className="min-h-[100dvh] px-4 py-6 max-w-[800px] mx-auto flex flex-col">
        {/* Header Menu */}
        <div className="md:hidden absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8"
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
          {/* Large Success Header */}
          <motion.div
            key="confirmation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            className="text-center pt-8"
          >
            <div className="relative inline-block">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
                className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center relative shadow-xl shadow-green-500/30"
              >
                <CheckCircle2 className="h-16 w-16 text-white" />
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                  className="absolute -top-1 -right-1 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Trophy className="h-5 w-5 text-yellow-800" />
                </motion.div>
              </motion.div>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-rocgrotesk font-bold text-foreground mt-4"
            >
              {t("congratulations")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground mt-2"
            >
              {marathon?.mode === "by-camera"
                ? t("photoUploaded")
                : t("photosUploaded", { count: submissions.length })}
            </motion.p>
          </motion.div>

          {/* Combined Participant Info & Thumbnail Card */}
          <motion.div
            key="participant-info"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <Card className="bg-green-50/60 border-green-200 dark:bg-green-950/20 dark:border-green-800 overflow-hidden">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  {/* Thumbnail Image */}
                  <div
                    className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-muted shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() =>
                      images[0]?.thumbnailUrl &&
                      setPreviewImage({
                        imageUrl: images[0].thumbnailUrl,
                        name: images[0].name,
                      })
                    }
                  >
                    {images[0]?.thumbnailUrl ? (
                      <img
                        src={images[0].thumbnailUrl}
                        alt={images[0].name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon
                          icon="solar:camera-minimalistic-broken"
                          className="w-8 h-8 text-green-300"
                        />
                      </div>
                    )}
                  </div>

                  {/* Participant Info */}
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <p className="text-3xl font-bold text-green-700 dark:text-green-300 font-mono">
                      #{participant.reference}
                    </p>
                    <p className="font-semibold text-green-900 dark:text-green-100 truncate mt-1">
                      {params.participantFirstName} {params.participantLastName}
                    </p>
                    {(participant.deviceGroup?.name ||
                      participant.competitionClass?.name) && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {participant.deviceGroup?.name && (
                          <span className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1 bg-green-100/50 dark:bg-green-900/30 px-2 py-1 rounded-full">
                            <Icon
                              icon="solar:bookmark-broken"
                              className="w-3 h-3"
                            />
                            {participant.deviceGroup.name}
                          </span>
                        )}
                        {participant.competitionClass?.name && (
                          <span className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1 bg-emerald-100/50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                            <Icon
                              icon="solar:camera-minimalistic-broken"
                              className="w-3 h-3"
                            />
                            {participant.competitionClass.name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Marathon Mode - Photo Grid */}
          {marathon?.mode !== "by-camera" && images.length > 0 && (
            <motion.div
              key="photos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-4"
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.08 },
                  },
                }}
                initial="hidden"
                animate="show"
                className="grid grid-cols-4 gap-2"
              >
                {images.map((image) => (
                  <motion.div
                    key={image.orderIndex}
                    variants={{
                      hidden: { opacity: 0, scale: 0.9 },
                      show: { opacity: 1, scale: 1 },
                    }}
                    className="relative rounded-lg overflow-hidden border bg-card cursor-pointer group aspect-square"
                    onClick={() => setSelectedImage(image)}
                  >
                    {image.thumbnailUrl ? (
                      <img
                        src={image.thumbnailUrl}
                        alt={image.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <span className="text-xs text-muted-foreground">
                          No image
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-white text-[10px] font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {image.name}
                      </p>
                    </div>
                    <div className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-3 w-3 text-white" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Desktop Action Buttons */}
          <motion.div
            key="restart"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="hidden md:flex gap-3 mt-6"
          >
            <PrimaryButton
              onClick={handleRedirect}
              className="flex-1 py-3 text-base rounded-full"
            >
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

          {/* Info Section */}
          {marathon?.mode === "by-camera" ? (
            <motion.div
              key="voting-info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-4"
            >
              <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      <Vote className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">
                        {t("votingTitle")}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                        {t("votingMessage")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="next-steps"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-4"
            >
              <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <h3 className="font-semibold">{t("whatsNext")}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex gap-2 items-start">
                      <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          1
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-snug">
                        {t("steps.1")}
                      </p>
                    </div>
                    <div className="flex gap-2 items-start">
                      <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          2
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-snug">
                        {t("steps.2")}
                      </p>
                    </div>
                    <div className="flex gap-2 items-start">
                      <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          3
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-snug">
                        {t("steps.3", { juryDate: "31/8", resultsDate: "1/9" })}
                      </p>
                    </div>
                    <div className="flex gap-2 items-start">
                      <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          4
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-snug">
                        {t("steps.4", { prizeDate: "20/8" })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmationDetailsDialog
          image={{
            thumbnailUrl: selectedImage?.thumbnailUrl,
            name: selectedImage?.name ?? "",
            orderIndex: selectedImage?.orderIndex ?? 0,
          }}
          open={!!selectedImage}
          onOpenChange={(open) => !open && setSelectedImage(null)}
        />

        {/* Full Page Image Preview */}
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImage.imageUrl}
                alt={previewImage.name}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
              <div className="absolute -bottom-12 left-0 right-0 text-center">
                <p className="text-white/80 text-sm">{previewImage.name}</p>
                <p className="text-white/50 text-xs mt-1">
                  Tap anywhere to close
                </p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-12 right-0 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <Icon
                  icon="solar:close-circle-broken"
                  className="w-6 h-6 text-white"
                />
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  );
}
