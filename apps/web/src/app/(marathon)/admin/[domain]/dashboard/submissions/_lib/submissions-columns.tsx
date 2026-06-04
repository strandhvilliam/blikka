'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import type { RealtimeEnrichedSubmissionTableRow } from './submissions-types'
import {
  CompetitionClassCell,
  CopyableContactCell,
  DateCell,
  DeviceGroupCell,
  NameCell,
  OpenIndicatorCell,
  ReferenceCell,
  SubmissionStatusBadge,
  UploadProgressBadge,
  ValidationResultsBadges,
  VotedBadge,
} from '../_components/submissions-column-cells'

interface SubmissionsColumnsOptions {
  marathonMode?: string
  verificationMode?: string
  participants: RealtimeEnrichedSubmissionTableRow[]
  selectedIds: Set<number>
  onToggleSelection: (id: number, event: React.MouseEvent) => void
  onToggleAll: () => void
}

function getSelectionColumn({
  participants,
  selectedIds,
  onToggleSelection,
  onToggleAll,
}: SubmissionsColumnsOptions): ColumnDef<RealtimeEnrichedSubmissionTableRow> {
  const visibleIds = participants.map((p) => p.id)
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length

  return {
    id: 'select',
    header: () => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={allVisibleSelected}
          data-state={someVisibleSelected ? 'indeterminate' : undefined}
          onClick={(e) => {
            e.stopPropagation()
            onToggleAll()
          }}
          aria-label="Select all visible"
        />
      </div>
    ),
    cell: ({ row }) => {
      const participant = row.original
      const isChecked = selectedIds.has(participant.id)
      return (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isChecked}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelection(participant.id, e as unknown as React.MouseEvent)
            }}
            aria-label={`Select participant ${participant.reference}`}
          />
        </div>
      )
    },
    size: 40,
  }
}

function getCommonColumns({
  marathonMode,
  verificationMode,
}: SubmissionsColumnsOptions): ColumnDef<RealtimeEnrichedSubmissionTableRow>[] {
  return [
    {
      accessorKey: 'reference',
      header: 'Reference',
      cell: ({ row }) => <ReferenceCell reference={row.getValue('reference')} />,
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const firstname = row.original.firstname
        const lastname = row.original.lastname
        return <NameCell firstname={firstname} lastname={lastname} />
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <CopyableContactCell
          value={row.getValue('email') as string | null}
          copiedToast="Email copied"
        />
      ),
    },
    ...(marathonMode !== 'marathon'
      ? [
          {
            id: 'phone',
            header: 'Phone',
            cell: ({ row }) => (
              <CopyableContactCell
                value={row.original.phoneNumber ?? null}
                copiedToast="Phone number copied"
                tabularNums
              />
            ),
          } satisfies ColumnDef<RealtimeEnrichedSubmissionTableRow>,
        ]
      : []),
    {
      accessorKey: 'createdAt',
      header: marathonMode === 'by-camera' ? 'Uploaded At' : 'Initialized At',
      cell: ({ row }) => (
        <DateCell
          participant={row.original}
          marathonMode={marathonMode}
          createdAt={row.getValue('createdAt') as string}
        />
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <SubmissionStatusBadge
          participant={row.original}
          status={row.getValue('status') as string}
          marathonMode={marathonMode}
          verificationMode={verificationMode}
        />
      ),
    },
    {
      id: 'uploadProgress',
      header: 'Upload',
      cell: ({ row }) => (
        <UploadProgressBadge participant={row.original} marathonMode={marathonMode} />
      ),
    },
  ]
}

function getByCameraColumns(): ColumnDef<RealtimeEnrichedSubmissionTableRow>[] {
  return [
    {
      id: 'voted',
      header: 'Voted',
      cell: ({ row }) => <VotedBadge votedAt={row.original.votingSession?.votedAt} />,
    },
  ]
}

function getMarathonColumns(): ColumnDef<RealtimeEnrichedSubmissionTableRow>[] {
  return [
    {
      id: 'competitionClass',
      header: 'Class',
      cell: ({ row }) => <CompetitionClassCell participant={row.original} />,
    },
  ]
}

function getDeviceGroupColumns(): ColumnDef<RealtimeEnrichedSubmissionTableRow>[] {
  return [
    {
      id: 'deviceGroup',
      header: 'Device Group',
      cell: ({ row }) => <DeviceGroupCell participant={row.original} />,
    },
  ]
}

function getValidationColumns(): ColumnDef<RealtimeEnrichedSubmissionTableRow>[] {
  return [
    {
      id: 'validationResults',
      header: 'Validation Results',
      cell: ({ row }) => <ValidationResultsBadges participant={row.original} />,
    },
  ]
}

function getTrailingColumns(): ColumnDef<RealtimeEnrichedSubmissionTableRow>[] {
  return [
    {
      id: 'openIndicator',
      enableSorting: false,
      header: () => <span className="sr-only">Open details</span>,
      cell: () => <OpenIndicatorCell />,
    },
  ]
}

export const getSubmissionsColumns = (
  options: SubmissionsColumnsOptions,
): ColumnDef<RealtimeEnrichedSubmissionTableRow>[] => [
  getSelectionColumn(options),
  ...getCommonColumns(options),
  ...(options.marathonMode === 'by-camera' ? getByCameraColumns() : getMarathonColumns()),
  ...getDeviceGroupColumns(),
  ...(options.marathonMode !== 'by-camera' ? getValidationColumns() : []),
  ...getTrailingColumns(),
]
