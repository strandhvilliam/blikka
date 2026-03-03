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
import { CompetitionClass } from "@blikka/db";
import { ClassSelectionItem } from "./class-selection-item";
import { useTranslations } from "next-intl";
import { useStepState } from "../_lib/step-state-context";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";

export function ClassSelectionStep({
  competitionClasses,
}: {
  competitionClasses: CompetitionClass[];
}) {
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState();
  const { handleNextStep, handlePrevStep } = useStepState();
  const t = useTranslations("FlowPage");

  return (
    <div className="max-w-4xl mx-auto space-y-10 min-h-[70dvh] flex flex-col justify-center">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
          {t("classSelection.title")}
        </CardTitle>
        <CardDescription className="text-center">
          {t("classSelection.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col justify-center gap-3 sm:gap-4">
        {competitionClasses.map((cc) => (
          <ClassSelectionItem
            key={cc.id}
            competitionClass={cc}
            isSelected={cc.id === uploadFlowState.competitionClassId}
            onSelect={() => setUploadFlowState({ competitionClassId: cc.id })}
          />
        ))}
      </CardContent>

      <CardFooter className="w-full px-4 flex flex-col gap-3 items-center justify-center">
        <PrimaryButton
          onClick={handleNextStep}
          disabled={!uploadFlowState.competitionClassId}
          className="w-full py-3.5 text-base sm:text-lg rounded-full"
        >
          {t("classSelection.continue")}
        </PrimaryButton>
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePrevStep}
          className="w-full sm:w-[220px]"
        >
          {t("classSelection.back")}
        </Button>
      </CardFooter>
    </div>
  );
}
