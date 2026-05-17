import { parseAsInteger, parseAsString, parseAsBoolean, useQueryStates } from 'nuqs'

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
      termsAccepted: parseAsBoolean,
      acceptedLocale: parseAsString,
      uploadInstructionsShown: parseAsBoolean.withDefault(false),
    },
    {
      urlKeys: {
        competitionClassId: 'cc',
        deviceGroupId: 'dg',
        participantId: 'pid',
        participantRef: 'pr',
        participantEmail: 'pe',
        participantFirstName: 'pf',
        participantLastName: 'pl',
        participantPhone: 'pp',
        replaceExistingActiveTopicUpload: 'ra',
        termsAccepted: 'ta',
        acceptedLocale: 'tl',
        uploadInstructionsShown: 'uis',
      },
    },
  )

  return { uploadFlowState, setUploadFlowState }
}
