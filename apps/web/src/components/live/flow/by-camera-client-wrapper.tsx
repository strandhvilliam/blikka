"use client"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { AnimatePresence } from "motion/react"
import dynamic from "next/dynamic"
import { useHandleBeforeUnload } from "@/hooks/live/flow/use-handle-before-unload"
import { BY_CAMERA_STEPS } from "@/lib/flow/constants"
import { getByCameraValidationWindow } from "@/lib/flow/live-validation-window"
import { ByCameraStepNavigator } from "@/components/live/flow/by-camera-step-navigator"
import { AnimatedStepWrapper } from "@/components/live/flow/animated-step-wrapper"
import { ParticipantDetailsStep } from "@/components/live/flow/participant-details-step"
import { DeviceSelectionStep } from "@/components/live/flow/device-selection-step"
import { ByCameraUploadStep } from "@/components/live/flow/by-camera-upload-step"
import { useStepState } from "@/lib/flow/step-state-context"
import { redirect } from "next/navigation"
import { formatDomainPathname } from "@/lib/utils"
import { getByCameraLiveAccessState } from "@/lib/by-camera/by-camera-live-access-state"

const NetworkStatusBanner = dynamic(
  () =>
    import("@/components/live/flow/network-status-banner").then((mod) => ({
      default: mod.NetworkStatusBanner,
    })),
  { ssr: false },
)

export function ByCameraClientWrapper() {
  useHandleBeforeUnload()
  const { step, direction } = useStepState()
  const trpc = useTRPC()

  const domain = useDomain()

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  )

  if (marathon.mode !== "by-camera") {
    redirect(formatDomainPathname(`/live`, domain, "live"))
  }

  const byCameraAccessState = getByCameraLiveAccessState(marathon)
  const activeTopic = byCameraAccessState.activeTopic

  if (byCameraAccessState.state !== "open" || !activeTopic) {
    redirect(formatDomainPathname(`/live`, domain, "live"))
  }

  const validationWindow = getByCameraValidationWindow(activeTopic)

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10 min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <NetworkStatusBanner />
      <div className="mb-10">
        <ByCameraStepNavigator />
      </div>
      <AnimatePresence initial={false} custom={direction} mode="wait">
        {step === BY_CAMERA_STEPS.ParticipantDetailsStep && (
          <AnimatedStepWrapper key={BY_CAMERA_STEPS.ParticipantDetailsStep} direction={direction}>
            <ParticipantDetailsStep mode="by-camera" />
          </AnimatedStepWrapper>
        )}
        {step === BY_CAMERA_STEPS.DeviceSelectionStep && (
          <AnimatedStepWrapper key={BY_CAMERA_STEPS.DeviceSelectionStep} direction={direction}>
            <DeviceSelectionStep deviceGroups={marathon.deviceGroups} isByCameraMode />
          </AnimatedStepWrapper>
        )}
        {step === BY_CAMERA_STEPS.UploadSubmissionStep && (
          <AnimatedStepWrapper key={BY_CAMERA_STEPS.UploadSubmissionStep} direction={direction}>
            <ByCameraUploadStep
              topic={activeTopic}
              ruleConfigs={marathon.ruleConfigs}
              {...validationWindow}
            />
          </AnimatedStepWrapper>
        )}
      </AnimatePresence>
    </div>
  )
}
