"use client";

import * as React from "react";
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
  return (
    <Drawer>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-4 border-b">
          <DrawerTitle className="text-xl flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            How Voting Works
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 py-4 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Rate Images */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600 fill-yellow-500" />
              </div>
              <h3 className="font-semibold text-base">Rate Images</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              Tap the stars below each photo to give it a rating from 1-5. You
              can change your rating anytime by tapping different stars.
            </p>
          </div>

          {/* Navigate Photos */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-base">Navigate Photos</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              Use the arrow buttons or swipe to move between photos. Tap the
              grid icon to see all thumbnails at once and jump to any image.
            </p>
          </div>

          {/* Filter by Rating */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-base">Filter by Rating</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              Use the filter buttons at the top to show only images with a
              specific rating. This helps you review your favorites or find
              unrated photos.
            </p>
          </div>

          {/* Cast Your Vote */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-base">Cast Your Vote</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              After rating all images, tap the heart button on your favorite
              photo to select it as your final vote. You can change your vote
              anytime before submitting.
            </p>
          </div>

          {/* Complete Voting */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-base">Complete Voting</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed pl-[52px]">
              Once you&apos;ve rated all images and selected your final vote,
              the button will turn green. Tap &quot;Complete Voting&quot; to
              submit your choices.
            </p>
          </div>

          {/* Progress indicator */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Your Progress</span>
              <span className="text-primary font-semibold">
                {votingInfo.rated} / {votingInfo.total} rated
              </span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${(votingInfo.rated / votingInfo.total) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
