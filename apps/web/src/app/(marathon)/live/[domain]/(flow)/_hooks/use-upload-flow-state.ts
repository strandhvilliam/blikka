import { parseAsInteger, parseAsString, parseAsBoolean, useQueryStates } from "nuqs"

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
      replaceExistingActiveTopicUpload: parseAsBoolean,
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
        replaceExistingActiveTopicUpload: "ra",
        uploadInstructionsShown: "uis",
      },
    },
  )

  return { uploadFlowState, setUploadFlowState }
}
