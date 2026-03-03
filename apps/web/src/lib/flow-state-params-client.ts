import { createSerializer, parseAsInteger, parseAsString } from "nuqs";

export const flowStateClientParams = {
  competitionClassId: parseAsInteger,
  deviceGroupId: parseAsInteger,
  participantId: parseAsInteger,
  participantRef: parseAsString,
  participantEmail: parseAsString,
  participantFirstName: parseAsString,
  participantLastName: parseAsString,
};


export interface FlowStateClientParams {
  competitionClassId?: number | null;
  deviceGroupId?: number | null;
  participantId?: number | null;
  participantRef?: string | null;
  participantEmail?: string | null;
  participantFirstName?: string | null;
  participantLastName?: string | null;
}



export const flowStateClientParamSerializer = createSerializer(
  flowStateClientParams,
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