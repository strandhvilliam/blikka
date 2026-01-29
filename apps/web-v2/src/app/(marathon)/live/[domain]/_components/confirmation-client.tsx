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
  Mail,
  MoreVertical,
  Recycle,
  Trophy,
  Vote,
} from "lucide-react";
import { Icon } from "@iconify/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDomainPathname } from "@/lib/utils";
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

const AWS_S3_BASE_URL = "https://s3.eu-north-1.amazonaws.com";
const THUMBNAILS_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME;
const PHOTOS_BUCKET = process.env.NEXT_PUBLIC_PHOTOS_BUCKET_NAME;

function buildS3Url(bucketName?: string, key?: string | null) {
  if (!bucketName || !key) return undefined;
  return `${AWS_S3_BASE_URL}/${bucketName}/${key}`;
}

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

  if (!participant) {
    return null;
  }

  return (
    <>
      <Confetti recycle={false} numberOfPieces={300} />
      <div className="min-h-[100dvh] px-4 py-6 space-y-6 max-w-[800px] mx-auto">
        <div className="md:hidden absolute top-4 right-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
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
          <motion.div
            key="confirmation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6 }}
            className="text-center space-y-6 pt-8"
          >
            <div className="relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
                className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 relative"
              >
                <CheckCircle2 className="h-14 w-14 text-white" />
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center"
                >
                  <Trophy className="h-4 w-4 text-yellow-800" />
                </motion.div>
              </motion.div>
            </div>

            <div className="space-y-3">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-rocgrotesk font-bold text-foreground"
              >
                {t("congratulations")}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground text-lg leading-relaxed"
              >
                {marathon?.mode === "by-camera"
                  ? t("photoUploaded")
                  : t("photosUploaded", { count: submissions.length })}
              </motion.p>
            </div>
          </motion.div>

          <motion.div
            key="participant"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="h-full"
          >
            <Card className="h-full bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-2xl text-green-600 dark:text-green-400 font-mono font-bold">
                        #{participant.reference}
                      </p>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        {params.participantFirstName}{" "}
                        {params.participantLastName}
                      </p>
                      {participant.deviceGroup?.name && (
                        <div className="flex items-center gap-2">
                          <Icon
                            icon="solar:bookmark-broken"
                            className="w-4 h-4 text-green-800"
                            style={{ transform: "rotate(-5deg)" }}
                          />
                          <p className="text-sm text-green-800 dark:text-green-200">
                            {participant.deviceGroup?.name}
                          </p>
                        </div>
                      )}
                      {participant.competitionClass?.name && (
                        <div className="flex items-center gap-2">
                          <Icon
                            icon="solar:camera-minimalistic-broken"
                            className="w-4 h-4 text-green-800"
                            style={{ transform: "rotate(-5deg)" }}
                          />
                          <p className="text-sm text-green-800 dark:text-green-200">
                            {participant.competitionClass?.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            key="restart"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="hidden md:block h-full"
          >
            <Card className="h-full border-primary/20 flex items-center justify-center w-full bg-transparent border-none shadow-none">
              <CardContent className="items-center justify-center flex gap-8 p-0 w-full px-4">
                <PrimaryButton
                  onClick={handleRedirect}
                  className="w-full py-5 text-base md:text-lg rounded-full m-0"
                >
                  {t("newParticipant")}
                  <span className="text-white/80">
                    {t("secondsSuffix", { seconds: remainingSeconds })}
                  </span>
                </PrimaryButton>
                <Button
                  variant="outline"
                  className="rounded-full text-lg w-fit py-5 h-full"
                  onClick={() => addSeconds(30)}
                >
                  <Clock className="w-5 h-5" />
                  {t("waitSeconds", { seconds: 30 })}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {marathon?.mode === "by-camera" && images.length > 0 ? (
            <motion.div
              key="by-camera-photo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <CardHeader className="pb-4 px-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {t("yourPhoto")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="relative rounded-3xl overflow-hidden border-2 border-primary/20 shadow-xl bg-background"
                >
                  <div className="aspect-[4/3] relative">
                    {images[0]?.thumbnailUrl ? (
                      <img
                        src={images[0].thumbnailUrl}
                        alt={images[0].name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <span className="text-muted-foreground">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-medium text-lg drop-shadow-md">
                      {images[0]?.name}
                    </p>
                  </div>
                </motion.div>
              </CardContent>
            </motion.div>
          ) : (
            <motion.div
              key="photos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <CardHeader className="pb-4 px-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {t("yourPhotos")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-0">
                <motion.div
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1 },
                    },
                  }}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {images.map((image) => (
                    <motion.div
                      key={image.orderIndex}
                      variants={{
                        hidden: { opacity: 0, x: -20 },
                        show: { opacity: 1, x: 0 },
                      }}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedImage(image)}
                    >
                      <div className="relative">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                          {image.thumbnailUrl ? (
                            <img
                              src={image.thumbnailUrl}
                              alt={image.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No image
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-lg text-muted-foreground">
                          #{image.orderIndex + 1}
                        </span>
                        <p className="font-medium truncate">{image.name}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </motion.div>
          )}

          {marathon?.mode === "by-camera" ? (
            <motion.div
              key="voting-info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200 dark:from-violet-950/20 dark:to-purple-950/20 dark:border-violet-800">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg text-violet-700 dark:text-violet-300">
                    <Vote className="h-5 w-5" />
                    {t("votingTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:px-4 px-2">
                  <div className="flex gap-3 items-start">
                    <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-foreground leading-relaxed">
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
              transition={{ delay: 0.8 }}
            >
              <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="h-5 w-5 text-primary" />
                    {t("whatsNext")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:px-4 px-2">
                  <div className="space-y-4">
                    <div className="flex gap-2 items-center">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          1
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-foreground">
                          {t("steps.1")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          2
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-foreground">
                          {t("steps.2")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          3
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-foreground">
                          {t("steps.3", {
                            juryDate: "31/8",
                            resultsDate: "1/9",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          4
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-foreground">
                          {t("steps.4", { prizeDate: "20/8" })}
                        </p>
                      </div>
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
      </div>
    </>
  );
}
