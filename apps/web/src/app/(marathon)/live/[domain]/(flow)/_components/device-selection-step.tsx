"use client"

import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { DeviceGroup } from "@blikka/db"
import { DeviceSelectionItem } from "./device-selection-item"
import { useTranslations } from "next-intl"
import { useUploadFlowState } from "../_hooks/use-upload-flow-state"
import { useStepState } from "@/lib/flow/step-state-context"
import { validateDeviceSelectionRequirements } from "@/lib/flow/upload-flow-state"

interface DeviceSelectionStepProps {
  deviceGroups: DeviceGroup[]
  isByCameraMode?: boolean
}

export function DeviceSelectionStep({
  deviceGroups,
  isByCameraMode = false,
}: DeviceSelectionStepProps) {
  const { handleNextStep, handlePrevStep } = useStepState()
  const t = useTranslations("FlowPage")
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState()

  const deviceSelectionValidation = validateDeviceSelectionRequirements(
    uploadFlowState,
    isByCameraMode,
  )
  const isValid = deviceSelectionValidation.ok

  const handleContinue = () => {
    if (!isValid) return
    handleNextStep()
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
          {t("deviceSelection.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {t("deviceSelection.description")}
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3">
        {deviceGroups.map((deviceGroup) => (
          <DeviceSelectionItem
            key={deviceGroup.id}
            deviceGroup={deviceGroup}
            isSelected={uploadFlowState.deviceGroupId === deviceGroup.id}
            onSelect={() => setUploadFlowState({ deviceGroupId: deviceGroup.id })}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3">
        <PrimaryButton
          onClick={handleContinue}
          disabled={!isValid}
          className="w-full rounded-full py-3.5 text-base"
        >
          {t("deviceSelection.continue")}
        </PrimaryButton>
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePrevStep}
          className="w-full"
        >
          {t("deviceSelection.back")}
        </Button>
      </div>
    </div>
  )
}
