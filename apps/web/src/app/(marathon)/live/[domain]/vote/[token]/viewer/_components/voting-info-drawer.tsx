"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Info,
  Star,
  ArrowLeftRight,
  SlidersHorizontal,
  Heart,
  CheckCircle2,
} from "lucide-react";

interface VotingInfo {
  rated: number;
  total: number;
}

interface VotingInfoDrawerProps {
  children: React.ReactNode;
  votingInfo: VotingInfo;
}

export function VotingInfoDrawer({
  children,
  votingInfo,
}: VotingInfoDrawerProps) {
  const t = useTranslations("VotingViewerPage");
  const voteButtonLabel = t("voteButton.voteForThisPhoto");

  return (
    <Drawer>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-4 border-b">
          <DrawerTitle className="text-xl flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            {t("infoDrawer.title")}
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 py-4 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Rate Images */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600 fill-yellow-500" />
              </div>
              <h3 className="font-semibold text-base">
                {t("infoDrawer.rateImages.title")}
              </h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              {t("infoDrawer.rateImages.description")}
            </p>
          </div>

          {/* Navigate Photos */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-base">
                {t("infoDrawer.navigatePhotos.title")}
              </h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              {t("infoDrawer.navigatePhotos.description")}
            </p>
          </div>

          {/* Filter by Rating */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-base">
                {t("infoDrawer.filterByRating.title")}
              </h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              {t("infoDrawer.filterByRating.description")}
            </p>
          </div>

          {/* Choose Your Final Photo */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-base">
                {t("infoDrawer.chooseFinalPhoto.title")}
              </h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              {t("infoDrawer.chooseFinalPhoto.description", {
                buttonLabel: voteButtonLabel,
              })}
            </p>
          </div>

          {/* Confirm Vote */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-base">
                {t("infoDrawer.confirmVote.title")}
              </h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              {t("infoDrawer.confirmVote.description", {
                buttonLabel: voteButtonLabel,
              })}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t("infoDrawer.progressTitle")}</span>
              <span className="text-primary font-semibold">
                {t("infoDrawer.progressValue", {
                  rated: votingInfo.rated,
                  total: votingInfo.total,
                })}
              </span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${
                    votingInfo.total > 0
                      ? (votingInfo.rated / votingInfo.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
