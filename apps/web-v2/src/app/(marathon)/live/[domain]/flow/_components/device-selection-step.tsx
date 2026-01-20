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

export function DeviceSelectionStep({ deviceGroups }: { deviceGroups: DeviceGroup[] }) {
  const t = useTranslations("FlowPage");
  const {
    uploadFlowState,
    setUploadFlowState,
    handleNextStep,
    handlePrevStep,
  } = useUploadFlowState();

  const isValid =
    uploadFlowState.deviceGroupId &&
    uploadFlowState.competitionClassId &&
    uploadFlowState.participantId &&
    uploadFlowState.participantFirstName &&
    uploadFlowState.participantLastName &&
    uploadFlowState.participantEmail;


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
          {t("deviceSelection.title")}
        </CardTitle>
        <CardDescription className="text-center">
          {t("deviceSelection.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
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
          onClick={handleNextStep}
          disabled={!isValid}
          className="w-full py-3 text-lg rounded-full"
        >
          {t("deviceSelection.continue")}
        </PrimaryButton>
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePrevStep}
          className="w-[200px]"
        >
          {t("deviceSelection.back")}
        </Button>
      </CardFooter>
    </div>
  );
}
