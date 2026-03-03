"use client";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useHandleBeforeUnload } from "../_hooks/use-handle-before-unload";
import { PARTICIPANT_SUBMISSION_STEPS } from "../_lib/constants";
import { StepNavigator } from "../_components/step-navigator";
import { AnimatedStepWrapper } from "../_components/animated-step-wrapper";
import { ParticipantNumberStep } from "../_components/participant-number-step";
import { ParticipantDetailsStep } from "../_components/participant-details-step";
import { ClassSelectionStep } from "../_components/class-selection-step";
import { DeviceSelectionStep } from "../_components/device-selection-step";
import { UploadSubmissionsStep } from "../_components/upload-submissions-step";
import { useStepState } from "../_lib/step-state-context";

const NetworkStatusBanner = dynamic(
  () =>
    import("../_components/network-status-banner").then((mod) => ({
      default: mod.NetworkStatusBanner,
    })),
  { ssr: false },
);

export function MarathonClientWrapper() {
  useHandleBeforeUnload();
  const { step, direction } = useStepState();
  const trpc = useTRPC();
  const { uploadFlowState } = useUploadFlowState();
  const domain = useDomain();

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  );

  const selectedCompetitionClass = useMemo(() => {
    if (!uploadFlowState.competitionClassId) return null;
    return (
      marathon.competitionClasses.find(
        (cc) => cc.id === uploadFlowState.competitionClassId,
      ) || null
    );
  }, [marathon.competitionClasses, uploadFlowState.competitionClassId]);

  const topicsForClass = useMemo(() => {
    if (!selectedCompetitionClass) return [];
    const sortedTopics = [...marathon.topics].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    return sortedTopics.slice(
      selectedCompetitionClass.topicStartIndex,
      selectedCompetitionClass.topicStartIndex +
        selectedCompetitionClass.numberOfPhotos,
    );
  }, [marathon.topics, selectedCompetitionClass]);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10 min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <NetworkStatusBanner />
      <div className="mb-10">
        <StepNavigator />
      </div>
      <AnimatePresence initial={false} custom={direction} mode="wait">
        {step === PARTICIPANT_SUBMISSION_STEPS.ParticipantNumberStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.ParticipantNumberStep}
            direction={direction}
          >
            <ParticipantNumberStep />
          </AnimatedStepWrapper>
        )}
        {step === PARTICIPANT_SUBMISSION_STEPS.ParticipantDetailsStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.ParticipantDetailsStep}
            direction={direction}
          >
            <ParticipantDetailsStep mode="marathon" />
          </AnimatedStepWrapper>
        )}
        {step === PARTICIPANT_SUBMISSION_STEPS.ClassSelectionStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.ClassSelectionStep}
            direction={direction}
          >
            <ClassSelectionStep
              competitionClasses={marathon.competitionClasses}
            />
          </AnimatedStepWrapper>
        )}
        {step === PARTICIPANT_SUBMISSION_STEPS.DeviceSelectionStep && (
          <AnimatedStepWrapper
            key={PARTICIPANT_SUBMISSION_STEPS.DeviceSelectionStep}
            direction={direction}
          >
            <DeviceSelectionStep deviceGroups={marathon.deviceGroups} />
          </AnimatedStepWrapper>
        )}
        {step === PARTICIPANT_SUBMISSION_STEPS.UploadSubmissionStep &&
          selectedCompetitionClass &&
          marathon.startDate &&
          marathon.endDate && (
            <AnimatedStepWrapper
              key={PARTICIPANT_SUBMISSION_STEPS.UploadSubmissionStep}
              direction={direction}
            >
              <UploadSubmissionsStep
                competitionClass={selectedCompetitionClass}
                topics={topicsForClass}
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
