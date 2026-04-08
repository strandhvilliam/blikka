"use client"

import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { CompetitionClass } from "@blikka/db"
import { ClassSelectionItem } from "./class-selection-item"
import { useTranslations } from "next-intl"
import { useStepState } from "@/lib/flow/step-state-context"
import { useUploadFlowState } from "../_hooks/use-upload-flow-state"

export function ClassSelectionStep({
  competitionClasses,
}: {
  competitionClasses: CompetitionClass[]
}) {
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState()
  const { handleNextStep, handlePrevStep } = useStepState()
  const t = useTranslations("FlowPage")

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
          {t("classSelection.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {t("classSelection.description")}
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3">
        {competitionClasses.map((cc) => (
          <ClassSelectionItem
            key={cc.id}
            competitionClass={cc}
            isSelected={cc.id === uploadFlowState.competitionClassId}
            onSelect={() => setUploadFlowState({ competitionClassId: cc.id })}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3">
        <PrimaryButton
          onClick={handleNextStep}
          disabled={!uploadFlowState.competitionClassId}
          className="w-full rounded-full py-3.5 text-base"
        >
          {t("classSelection.continue")}
        </PrimaryButton>
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePrevStep}
          className="w-full"
        >
          {t("classSelection.back")}
        </Button>
      </div>
    </div>
  )
}
