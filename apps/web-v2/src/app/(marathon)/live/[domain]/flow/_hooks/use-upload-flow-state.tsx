import {
  parseAsInteger,
  parseAsString,
  parseAsBoolean,
  useQueryStates,
  useQueryState,
} from "nuqs";
import { PARTICIPANT_SUBMISSION_STEPS } from "../_lib/constants";
import { useState } from "react";

export function useUploadFlowState() {
  const [uploadFlowState, setUploadFlowState] = useQueryStates(
    {
      competitionClassId: parseAsInteger,
      deviceGroupId: parseAsInteger,
      participantId: parseAsInteger,
      participantRef: parseAsString,
      participantEmail: parseAsString,
      participantFirstName: parseAsString,
      participantLastName: parseAsString,
      uploadInstructionsShown: parseAsBoolean.withDefault(false),
    },
    {
      urlKeys: {
        competitionClassId: "cc",
        deviceGroupId: "dg",
        participantId: "pid",
        participantRef: "pr",
        participantEmail: "pe",
        participantFirstName: "pf",
        participantLastName: "pl",
        uploadInstructionsShown: "uis",
      },
    },
  );

  const [step, setStep] = useQueryState(
    "s",
    parseAsInteger.withDefault(1).withOptions({ history: "push" }),
  );
  const [direction, setDirection] = useState(0);

  const handleNextStep = () => {
    const nextStep = Math.min(
      step + 1,
      Object.keys(PARTICIPANT_SUBMISSION_STEPS).length,
    );
    setDirection(1);
    setStep(nextStep);
  };

  const handlePrevStep = () => {
    const prevStep = Math.max(step - 1, 1);
    setDirection(-1);
    setStep(prevStep);
  };
  const handleSetStep = (newStep: number) => {
    setDirection(newStep > step ? 1 : -1);
    setStep(newStep);
  };

  return { uploadFlowState, setUploadFlowState, step, direction, handleNextStep, handlePrevStep, handleSetStep };
}
