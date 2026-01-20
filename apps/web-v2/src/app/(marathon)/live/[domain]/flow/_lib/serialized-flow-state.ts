import { createSerializer, parseAsInteger, parseAsString } from "nuqs";

export const flowStateParams = {
  competitionClassId: parseAsInteger,
  deviceGroupId: parseAsInteger,
  participantId: parseAsInteger,
  participantRef: parseAsString,
  participantEmail: parseAsString,
  participantFirstName: parseAsString,
  participantLastName: parseAsString,
};

export const flowStateParamSerializer = createSerializer(
  flowStateParams,
  {
    urlKeys: {
      competitionClassId: "cc",
      deviceGroupId: "dg",
      participantId: "pid",
      participantRef: "pr",
      participantEmail: "pe",
      participantFirstName: "pf",
      participantLastName: "pl",
    },
  },
);
