"use client"
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useHandleBeforeUnload } from "../_hooks/use-handle-before-unload";
import { BY_CAMERA_STEPS } from "../_lib/constants";
import { ByCameraStepNavigator } from "../_components/by-camera-step-navigator";
import { AnimatedStepWrapper } from "../_components/animated-step-wrapper";
import { ParticipantNumberStep } from "../_components/participant-number-step";
import { ParticipantDetailsStep } from "../_components/participant-details-step";
import { DeviceSelectionStep } from "../_components/device-selection-step";
import { ByCameraUploadStep } from "../_components/by-camera-upload-step";
import { useStepState } from "../_lib/step-state-context";

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
  const {
    uploadFlowState,
  } =
    useUploadFlowState();
  const domain = useDomain();

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10 h-screen">
      <NetworkStatusBanner />
      <div className="mb-10">
        <ByCameraStepNavigator />
      </div>
      <AnimatePresence initial={false} custom={direction} mode="wait">
        {step === BY_CAMERA_STEPS.ParticipantNumberStep && (
          <AnimatedStepWrapper
            key={BY_CAMERA_STEPS.ParticipantNumberStep}
            direction={direction}
          >
            <ParticipantNumberStep />
          </AnimatedStepWrapper>
        )}
        {step === BY_CAMERA_STEPS.ParticipantDetailsStep && (
          <AnimatedStepWrapper
            key={BY_CAMERA_STEPS.ParticipantDetailsStep}
            direction={direction}
          >
            <ParticipantDetailsStep />
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
        {step === BY_CAMERA_STEPS.UploadSubmissionStep &&
          marathon.startDate &&
          marathon.endDate && (
            <AnimatedStepWrapper
              key={BY_CAMERA_STEPS.UploadSubmissionStep}
              direction={direction}
            >
              <ByCameraUploadStep
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
