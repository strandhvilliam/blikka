import { ClipboardCheck, FileSpreadsheet, Gavel } from 'lucide-react'

import { type ExportTypeConfig } from './types'

const JURY_RESULTS_EXPORT: ExportTypeConfig = {
  id: 'jury-results',
  title: 'Jury Results',
  description:
    "Every juror's shortlist and winner per topic or class, with how many jurors picked each entry.",
  icon: Gavel,
  exportType: 'csv_jury_results',
  downloadName: 'jury-results',
  accentColor: '#8b5cf6', // violet
}

/**
 * Exports that stay available while the marathon is live. The rest are held back until it ends, but
 * these read data that is either unrelated to the active topic or only produced after the race. (The
 * jury result images are their own card — {@link JuryImagesFolderCard} — not a generic export type.)
 */
export const ALWAYS_AVAILABLE_EXPORT_TYPES = new Set<string>([
  'xlsx_participants_by_camera_all_topics',
  JURY_RESULTS_EXPORT.exportType,
])

export const MARATHON_EXPORT_TYPES: ExportTypeConfig[] = [
  {
    id: 'participants',
    title: 'Participants',
    description:
      'Contact details, competition class, and device group for all registered participants.',
    icon: FileSpreadsheet,
    exportType: 'xlsx_participants',
    downloadName: 'participants',
    accentColor: '#10b981', // emerald
  },
  {
    id: 'submissions',
    title: 'Submissions',
    description: 'Upload times, status, and validation results for all photo submissions.',
    icon: FileSpreadsheet,
    exportType: 'xlsx_submissions',
    downloadName: 'submissions',
    accentColor: '#3b82f6', // blue
  },
  {
    id: 'validation',
    title: 'Validation Results',
    description: 'Detailed validation outcomes showing which submissions passed or failed rules.',
    icon: ClipboardCheck,
    exportType: 'txt_validation_results',
    downloadName: 'validation-results',
    accentColor: '#f59e0b', // amber
    validationOptions: [
      { value: 'failed', label: 'Failed Only' },
      { value: 'all', label: 'All Results' },
    ],
    fileFormatOptions: [
      { value: 'single', label: 'Single File' },
      { value: 'folder', label: 'Per Participant (ZIP)' },
    ],
  },
  JURY_RESULTS_EXPORT,
]

export const BY_CAMERA_EXPORT_TYPES: ExportTypeConfig[] = [
  {
    id: 'participants',
    title: 'All Participants Across Topics',
    description:
      'Every by-camera participant, not just the active topic. Includes contact details, phone number, topics participated in, latest topic, and latest upload time.',
    icon: FileSpreadsheet,
    exportType: 'xlsx_participants_by_camera_all_topics',
    downloadName: 'participants-all-topics',
    accentColor: '#10b981',
  },
  {
    id: 'submissions',
    title: 'Submissions',
    description:
      'Submission uploaded to the active topic. Includes information about submission, participant and URL to the image',
    icon: FileSpreadsheet,
    exportType: 'xlsx_submissions_by_camera_active_topic',
    downloadName: 'submissions-active-topic',
    accentColor: '#3b82f6',
  },
  {
    id: 'validation',
    title: 'Validation Results',
    description: 'Validation results tied to files uploaded to the active topic only.',
    icon: ClipboardCheck,
    exportType: 'txt_validation_results_by_camera_active_topic',
    downloadName: 'validation-results-active-topic',
    accentColor: '#f59e0b',
    validationOptions: [
      { value: 'failed', label: 'Failed Only' },
      { value: 'all', label: 'All Results' },
    ],
    fileFormatOptions: [
      { value: 'single', label: 'Single File' },
      { value: 'folder', label: 'Per Participant (ZIP)' },
    ],
  },
  JURY_RESULTS_EXPORT,
]
