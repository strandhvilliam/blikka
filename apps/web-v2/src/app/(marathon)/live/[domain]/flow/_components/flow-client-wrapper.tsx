"use client"
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useHandleBeforeUnload } from "../_hooks/use-handle-before-unload";
import { PARTICIPANT_SUBMISSION_STEPS } from "../_lib/constants";
import { flowStateParamSerializer } from "../_lib/serialized-flow-state";
import { formatDomainPathname } from "@/lib/utils";
import { StepNavigator } from "./step-navigator";
import { AnimatedStepWrapper } from "./animated-step-wrapper";
import { ParticipantNumberStep } from "./participant-number-step";
import { ParticipantDetailsStep } from "./participant-details-step";
import { ClassSelectionStep } from "./class-selection-step";
import { DeviceSelectionStep } from "./device-selection-step";

const NetworkStatusBanner = dynamic(
  () =>
    import("./network-status-banner").then((mod) => ({
      default: mod.NetworkStatusBanner,
    })),
  { ssr: false },
);

export function FlowClientWrapper() {
  useHandleBeforeUnload();
  const trpc = useTRPC();
  const router = useRouter();
  const {
    uploadFlowState,
    setUploadFlowState,
    step,
    direction,
    handleNextStep,
    handlePrevStep,
    handleSetStep,
  } =
    useUploadFlowState();
  const domain = useDomain();

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  );

  const handleNavigateToVerification = () => {
    const params = flowStateParamSerializer(uploadFlowState);
    router.push(formatDomainPathname(`/flow/verification${params}`, domain, 'live'));
  };


  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
      <NetworkStatusBanner />
      <div className="mb-10">
        <StepNavigator currentStep={step} handleSetStep={handleSetStep} />
      </div>
      <AnimatePresence initial={false} custom={direction} mode="wait">
        {step === PARTICIPANT_SUBMISSION_STEPS.ParticipantNumberStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.ParticipantNumberStep}
            direction={direction}
          >
            <ParticipantNumberStep
              marathon={marathon}
              uploadFlowState={uploadFlowState}
              setUploadFlowState={setUploadFlowState}
              handleNextStep={handleNextStep}
            />
          </AnimatedStepWrapper>
        )}
        {step === PARTICIPANT_SUBMISSION_STEPS.ParticipantDetailsStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.ParticipantDetailsStep}
            direction={direction}
          >
            <ParticipantDetailsStep
              uploadFlowState={uploadFlowState}
              setUploadFlowState={setUploadFlowState}
              handleNextStep={handleNextStep}
              handlePrevStep={handlePrevStep}
            />
          </AnimatedStepWrapper>
        )}
        {step === PARTICIPANT_SUBMISSION_STEPS.ClassSelectionStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.ClassSelectionStep}
            direction={direction}
          >
            <ClassSelectionStep
              competitionClasses={marathon.competitionClasses}
              uploadFlowState={uploadFlowState}
              setUploadFlowState={setUploadFlowState}
              handleNextStep={handleNextStep}
              handlePrevStep={handlePrevStep}
            />
          </AnimatedStepWrapper>
        )}
        {step === PARTICIPANT_SUBMISSION_STEPS.DeviceSelectionStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.DeviceSelectionStep}
            direction={direction}
          >
            <DeviceSelectionStep
              deviceGroups={marathon.deviceGroups}
              uploadFlowState={uploadFlowState}
              setUploadFlowState={setUploadFlowState}
              handleNextStep={handleNextStep}
              handlePrevStep={handlePrevStep}
            />
          </AnimatedStepWrapper>
        )}
        {/* {step === PARTICIPANT_SUBMISSION_STEPS.UploadSubmissionStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.UploadSubmissionStep}
            direction={direction}
          >
            <UploadSubmissionsStep
              realtimeConfig={realtimeConfig}
              marathon={marathon}
              competitionClasses={competitionClasses}
              topics={topics}
              ruleConfigs={mapDbRuleConfigsToValidationConfigs(ruleConfigs)}
              onPrevStep={handlePrevStep}
              onNextStep={handleNavigateToVerification}
            />
          </AnimatedStepWrapper>
        )} */}
      </AnimatePresence>
    </div>
  );
}