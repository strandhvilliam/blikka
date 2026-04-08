"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Info,
  Star,
  ArrowLeftRight,
  SlidersHorizontal,
  Heart,
  CheckCircle2,
} from "lucide-react"

interface VotingInfo {
  rated: number
  total: number
}

interface VotingInfoDrawerProps {
  children: React.ReactNode
  votingInfo: VotingInfo
}

export function VotingInfoDrawer({ children, votingInfo }: VotingInfoDrawerProps) {
  const t = useTranslations("VotingViewerPage")
  const voteButtonLabel = t("voteButton.voteForThisPhoto")

  const steps = [
    {
      icon: <Star className="h-5 w-5 text-yellow-600 fill-yellow-500" />,
      bgClass: "bg-yellow-500/10",
      titleKey: "infoDrawer.rateImages.title" as const,
      descKey: "infoDrawer.rateImages.description" as const,
    },
    {
      icon: <ArrowLeftRight className="h-5 w-5 text-blue-600" />,
      bgClass: "bg-blue-500/10",
      titleKey: "infoDrawer.navigatePhotos.title" as const,
      descKey: "infoDrawer.navigatePhotos.description" as const,
    },
    {
      icon: <SlidersHorizontal className="h-5 w-5 text-purple-600" />,
      bgClass: "bg-purple-500/10",
      titleKey: "infoDrawer.filterByRating.title" as const,
      descKey: "infoDrawer.filterByRating.description" as const,
    },
    {
      icon: <Heart className="h-5 w-5 text-red-600" />,
      bgClass: "bg-red-500/10",
      titleKey: "infoDrawer.chooseFinalPhoto.title" as const,
      descKey: "infoDrawer.chooseFinalPhoto.description" as const,
    },
    {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      bgClass: "bg-emerald-500/10",
      titleKey: "infoDrawer.confirmVote.title" as const,
      descKey: "infoDrawer.confirmVote.description" as const,
    },
  ]

  return (
    <Drawer>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-4">
          <DrawerTitle className="flex items-center gap-2 text-xl">
            <Info className="h-5 w-5 text-foreground" />
            {t("infoDrawer.title")}
          </DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[calc(85vh-80px)] space-y-3 overflow-y-auto px-4 py-4">
          {steps.map((step) => (
            <div
              key={step.titleKey}
              className="rounded-2xl border border-border bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${step.bgClass}`}
                >
                  {step.icon}
                </div>
                <h3 className="text-sm font-semibold text-foreground">{t(step.titleKey)}</h3>
              </div>
              <p className="mt-2 pl-[52px] text-sm leading-relaxed text-muted-foreground">
                {step.descKey.includes("chooseFinalPhoto") || step.descKey.includes("confirmVote")
                  ? t(step.descKey, { buttonLabel: voteButtonLabel })
                  : t(step.descKey)}
              </p>
            </div>
          ))}

          {/* Progress */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t("infoDrawer.progressTitle")}</span>
              <span className="font-semibold text-foreground">
                {t("infoDrawer.progressValue", {
                  rated: votingInfo.rated,
                  total: votingInfo.total,
                })}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-300"
                style={{
                  width: `${
                    votingInfo.total > 0 ? (votingInfo.rated / votingInfo.total) * 100 : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
