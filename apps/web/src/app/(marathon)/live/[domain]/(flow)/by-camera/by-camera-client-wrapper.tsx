"use client";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { useHandleBeforeUnload } from "../_hooks/use-handle-before-unload";
import { BY_CAMERA_STEPS } from "../_lib/constants";
import { ByCameraStepNavigator } from "../_components/by-camera-step-navigator";
import { AnimatedStepWrapper } from "../_components/animated-step-wrapper";
import { ParticipantDetailsStep } from "../_components/participant-details-step";
import { DeviceSelectionStep } from "../_components/device-selection-step";
import { ByCameraUploadStep } from "../_components/by-camera-upload-step";
import { useStepState } from "../_lib/step-state-context";
import { redirect } from "next/navigation";
import { formatDomainPathname } from "@/lib/utils";

const NetworkStatusBanner = dynamic(
  () =>
    import("../_components/network-status-banner").then((mod) => ({
      default: mod.NetworkStatusBanner,
    })),
  { ssr: false },
);

export function ByCameraClientWrapper() {
  useHandleBeforeUnload();
  const { step, direction } = useStepState();
  const trpc = useTRPC();

  const domain = useDomain();

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  );

  if (!marathon.startDate || !marathon.endDate) {
    redirect(formatDomainPathname(`/live/not-configured`, domain, "live"));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10 min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <NetworkStatusBanner />
      <div className="mb-10">
        <ByCameraStepNavigator />
      </div>
      <AnimatePresence initial={false} custom={direction} mode="wait">
        {step === BY_CAMERA_STEPS.ParticipantDetailsStep && (
          <AnimatedStepWrapper
            key={BY_CAMERA_STEPS.ParticipantDetailsStep}
            direction={direction}
          >
            <ParticipantDetailsStep mode="by-camera" />
          </AnimatedStepWrapper>
        )}
        {step === BY_CAMERA_STEPS.DeviceSelectionStep && (
          <AnimatedStepWrapper
            key={BY_CAMERA_STEPS.DeviceSelectionStep}
            direction={direction}
          >
            <DeviceSelectionStep
              deviceGroups={marathon.deviceGroups}
              isByCameraMode
            />
          </AnimatedStepWrapper>
        )}
        {step === BY_CAMERA_STEPS.UploadSubmissionStep && (
          <AnimatedStepWrapper
            key={BY_CAMERA_STEPS.UploadSubmissionStep}
            direction={direction}
          >
            <ByCameraUploadStep
              topic={marathon.topics[0]}
              ruleConfigs={marathon.ruleConfigs}
              marathonStartDate={marathon.startDate}
              marathonEndDate={marathon.endDate}
            />
          </AnimatedStepWrapper>
        )}
      </AnimatePresence>
    </div>
  );
}
