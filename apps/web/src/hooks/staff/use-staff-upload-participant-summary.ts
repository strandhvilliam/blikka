"use client"

import { useMemo } from "react"
import { useStaffUploadStore } from "@/lib/staff/staff-upload-store"
import { normalizeParticipantReference } from "@/lib/staff/staff-utils"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import type { UploadMarathonMode } from "@/lib/types"

export function useStaffUploadParticipantSummary() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const marathonMode = marathon.mode as UploadMarathonMode
  const sortedTopics = marathon.topics.toSorted((a, b) => a.orderIndex - b.orderIndex)
  const activeByCameraTopic = sortedTopics.find((topic) => topic.visibility === "active") ?? null

  const existingParticipant = useStaffUploadStore((state) => state.existingParticipant)
  const formValues = useStaffUploadStore((state) => state.formValues)
  const participantStatus = useStaffUploadStore((state) => state.participantStatus)

  return useMemo(() => {
    const activeCompetitionClassId = existingParticipant
      ? String(existingParticipant.competitionClassId)
      : formValues.competitionClassId
    const activeDeviceGroupId = existingParticipant
      ? String(existingParticipant.deviceGroupId)
      : formValues.deviceGroupId

    const selectedCompetitionClass =
      marathon.competitionClasses.find((cc) => cc.id === Number(activeCompetitionClassId)) ?? null
    const selectedDeviceGroup =
      marathon.deviceGroups.find((dg) => dg.id === Number(activeDeviceGroupId)) ?? null

    if (marathonMode === "by-camera") {
      if (!activeByCameraTopic || !selectedDeviceGroup) {
        return null
      }

      if (existingParticipant) {
        return {
          reference: normalizeParticipantReference(existingParticipant.reference),
          firstName: existingParticipant.firstname,
          lastName: existingParticipant.lastname,
          email: existingParticipant.email ?? "",
          detailChip: {
            label: "Topic" as const,
            value: activeByCameraTopic.name,
          },
          deviceGroupName: selectedDeviceGroup.name,
          statusLabel:
            participantStatus === "initialized"
              ? "Existing in-progress upload"
              : "Prepared participant",
          statusTone:
            participantStatus === "initialized" ? ("warning" as const) : ("default" as const),
        }
      }

      const refTrim = formValues.reference.trim()
      return {
        reference: refTrim ? normalizeParticipantReference(formValues.reference) : "",
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        email: formValues.email,
        detailChip: {
          label: "Topic" as const,
          value: activeByCameraTopic.name,
        },
        deviceGroupName: selectedDeviceGroup.name,
        statusLabel: "Manual entry",
        statusTone: "default" as const,
      }
    }

    if (existingParticipant && selectedCompetitionClass && selectedDeviceGroup) {
      return {
        reference: normalizeParticipantReference(existingParticipant.reference),
        firstName: existingParticipant.firstname,
        lastName: existingParticipant.lastname,
        email: existingParticipant.email ?? "",
        detailChip: { label: "Class" as const, value: selectedCompetitionClass.name },
        deviceGroupName: selectedDeviceGroup.name,
        statusLabel:
          participantStatus === "initialized"
            ? "Existing in-progress upload"
            : "Prepared participant",
        statusTone:
          participantStatus === "initialized" ? ("warning" as const) : ("default" as const),
      }
    }

    if (selectedCompetitionClass && selectedDeviceGroup) {
      return {
        reference: formValues.reference,
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        email: formValues.email,
        detailChip: { label: "Class" as const, value: selectedCompetitionClass.name },
        deviceGroupName: selectedDeviceGroup.name,
        statusLabel: "Manual entry",
        statusTone: "default" as const,
      }
    }

    return null
  }, [
    activeByCameraTopic,
    marathon.competitionClasses,
    marathon.deviceGroups,
    marathonMode,
    existingParticipant,
    formValues.competitionClassId,
    formValues.deviceGroupId,
    formValues.email,
    formValues.firstName,
    formValues.lastName,
    formValues.reference,
    participantStatus,
  ])
}
