export const SUBMISSION_TAB = {
  ALL: 'all',
  PREPARED: 'prepared',
  INITIALIZED: 'initialized',
  UPLOADED: 'uploaded',
  NOT_VERIFIED: 'not-verified',
  VERIFIED: 'verified',
  NOT_VOTED: 'not-voted',
  VOTED: 'voted',
  VALIDATION_ERRORS: 'validation-errors',
} as const

export type SubmissionTab = (typeof SUBMISSION_TAB)[keyof typeof SUBMISSION_TAB]

export interface SubmissionTabDefinition {
  value: SubmissionTab
  label: string
}

export interface TabQueryParams {
  statusFilter: 'completed' | 'verified' | null
  excludeStatuses: string[] | null
  includeStatuses: string[] | null
  hasValidationErrors: boolean | null
  votedFilter: 'voted' | 'not-voted' | null
}

const MARATHON_TABS: SubmissionTabDefinition[] = [
  { value: SUBMISSION_TAB.ALL, label: 'All Submissions' },
  { value: SUBMISSION_TAB.PREPARED, label: 'Prepared' },
  { value: SUBMISSION_TAB.INITIALIZED, label: 'Initialized' },
  { value: SUBMISSION_TAB.UPLOADED, label: 'Uploaded' },
  { value: SUBMISSION_TAB.NOT_VERIFIED, label: 'Not Verified' },
  { value: SUBMISSION_TAB.VERIFIED, label: 'Verified' },
  { value: SUBMISSION_TAB.VALIDATION_ERRORS, label: 'Validation Errors' },
]

const BY_CAMERA_TABS: SubmissionTabDefinition[] = [
  { value: SUBMISSION_TAB.ALL, label: 'All Submissions' },
  { value: SUBMISSION_TAB.INITIALIZED, label: 'Initialized' },
  { value: SUBMISSION_TAB.UPLOADED, label: 'Uploaded' },
  { value: SUBMISSION_TAB.NOT_VOTED, label: 'Not Voted' },
  { value: SUBMISSION_TAB.VOTED, label: 'Voted' },
  { value: SUBMISSION_TAB.VALIDATION_ERRORS, label: 'Validation Errors' },
]

export function getSubmissionTabsForMode(mode: string): SubmissionTabDefinition[] {
  return mode === 'by-camera' ? BY_CAMERA_TABS : MARATHON_TABS
}

export function normalizeSubmissionTabForMode(tab: SubmissionTab, mode: string): SubmissionTab {
  if (
    mode === 'by-camera' &&
    (tab === SUBMISSION_TAB.PREPARED ||
      tab === SUBMISSION_TAB.NOT_VERIFIED ||
      tab === SUBMISSION_TAB.VERIFIED)
  ) {
    return SUBMISSION_TAB.ALL
  }

  if (
    mode !== 'by-camera' &&
    (tab === SUBMISSION_TAB.NOT_VOTED || tab === SUBMISSION_TAB.VOTED)
  ) {
    return SUBMISSION_TAB.ALL
  }

  return tab
}

export function getTabQueryParams(activeTab: SubmissionTab): TabQueryParams {
  switch (activeTab) {
    case SUBMISSION_TAB.ALL:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: null,
      }
    case SUBMISSION_TAB.PREPARED:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: ['prepared'],
        hasValidationErrors: null,
        votedFilter: null,
      }
    case SUBMISSION_TAB.INITIALIZED:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: ['initialized'],
        hasValidationErrors: null,
        votedFilter: null,
      }
    case SUBMISSION_TAB.UPLOADED:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: ['completed', 'verified'],
        hasValidationErrors: null,
        votedFilter: null,
      }
    case SUBMISSION_TAB.NOT_VERIFIED:
      return {
        statusFilter: 'completed',
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: null,
      }
    case SUBMISSION_TAB.VERIFIED:
      return {
        statusFilter: 'verified',
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: null,
      }
    case SUBMISSION_TAB.NOT_VOTED:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: 'not-voted',
      }
    case SUBMISSION_TAB.VOTED:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: 'voted',
      }
    case SUBMISSION_TAB.VALIDATION_ERRORS:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: true,
        votedFilter: null,
      }
    default:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: null,
      }
  }
}
