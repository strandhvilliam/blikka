"use client";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { DeviceGroup } from "@blikka/db";
import { DeviceSelectionItem } from "./device-selection-item";
import { useTranslations } from "next-intl";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useStepState } from "../_lib/step-state-context";

interface DeviceSelectionStepProps {
  deviceGroups: DeviceGroup[];
  isByCameraMode?: boolean;
}

export function DeviceSelectionStep({
  deviceGroups,
  isByCameraMode = false,
}: DeviceSelectionStepProps) {
  const { handleNextStep, handlePrevStep } = useStepState();
  const t = useTranslations("FlowPage");
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState();

  // For marathon mode, competition class is required
  // For by-camera mode, it's not needed
  const isValid = isByCameraMode
    ? uploadFlowState.deviceGroupId &&
    uploadFlowState.participantFirstName &&
    uploadFlowState.participantLastName &&
    uploadFlowState.participantEmail
    : uploadFlowState.deviceGroupId &&
    uploadFlowState.competitionClassId &&
    uploadFlowState.participantFirstName &&
    uploadFlowState.participantLastName &&
    uploadFlowState.participantEmail;

  const handleContinue = () => {
    if (!isValid) return
    handleNextStep();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 min-h-[70vh] flex flex-col justify-center">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
          {t("deviceSelection.title")}
        </CardTitle>
        <CardDescription className="text-center">
          {t("deviceSelection.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 sm:gap-4">
        {deviceGroups.map((deviceGroup) => (
          <DeviceSelectionItem
            key={deviceGroup.id}
            deviceGroup={deviceGroup}
            isSelected={uploadFlowState.deviceGroupId === deviceGroup.id}
            onSelect={() =>
              setUploadFlowState({ deviceGroupId: deviceGroup.id })
            }
          />
        ))}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 items-center justify-center pt-4 px-4 sm:px-0">
        <PrimaryButton
          onClick={handleContinue}
          disabled={!isValid}
          className="w-full py-3.5 text-base sm:text-lg rounded-full"
        >
          {t("deviceSelection.continue")}
        </PrimaryButton>
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePrevStep}
          className="w-full sm:w-[220px]"
        >
          {t("deviceSelection.back")}
        </Button>
      </CardFooter>
    </div>
  );
}
