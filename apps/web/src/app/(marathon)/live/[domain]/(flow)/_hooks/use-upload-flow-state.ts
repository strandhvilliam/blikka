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
      participantPhone: parseAsString,
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
        participantPhone: "pp",
        uploadInstructionsShown: "uis",
      },
    },
  );

  return { uploadFlowState, setUploadFlowState };
}
