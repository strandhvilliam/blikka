import {
  createLoader,
  createSerializer,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from 'nuqs/server'

export const flowStateServerParams = {
  competitionClassId: parseAsInteger,
  deviceGroupId: parseAsInteger,
  participantId: parseAsInteger,
  participantRef: parseAsString,
  participantEmail: parseAsString,
  participantFirstName: parseAsString,
  participantLastName: parseAsString,
  termsAccepted: parseAsBoolean,
  acceptedLocale: parseAsString,
}

export const flowStateServerLoader = createLoader(flowStateServerParams, {
  urlKeys: {
    competitionClassId: 'cc',
    deviceGroupId: 'dg',
    participantId: 'pid',
    participantRef: 'pr',
    participantEmail: 'pe',
    participantFirstName: 'pf',
    participantLastName: 'pl',
    termsAccepted: 'ta',
    acceptedLocale: 'tl',
  },
})

export const flowStateServerParamSerializer = createSerializer(flowStateServerParams, {
  urlKeys: {
    competitionClassId: 'cc',
    deviceGroupId: 'dg',
    participantId: 'pid',
    participantRef: 'pr',
    participantEmail: 'pe',
    participantFirstName: 'pf',
    participantLastName: 'pl',
    termsAccepted: 'ta',
    acceptedLocale: 'tl',
  },
})
