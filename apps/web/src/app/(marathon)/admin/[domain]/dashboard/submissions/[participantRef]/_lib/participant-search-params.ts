import { parseAsStringLiteral } from 'nuqs/server'

export const PARTICIPANT_TAB = {
  SUBMISSIONS: 'submissions',
  VALIDATION: 'validation',
  CONTACT_SHEET: 'contact-sheet',
} as const

export type ParticipantTab = (typeof PARTICIPANT_TAB)[keyof typeof PARTICIPANT_TAB]

export const participantSearchParams = {
  tab: parseAsStringLiteral([
    PARTICIPANT_TAB.SUBMISSIONS,
    PARTICIPANT_TAB.VALIDATION,
    PARTICIPANT_TAB.CONTACT_SHEET,
  ]).withDefault(PARTICIPANT_TAB.SUBMISSIONS),
}
