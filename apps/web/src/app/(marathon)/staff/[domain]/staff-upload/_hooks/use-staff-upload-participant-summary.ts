"use client"

import { useMemo } from "react"
import { useStaffUploadStore } from "../_lib/staff-upload-store"
import { normalizeParticipantReference } from "../../_lib/staff-utils"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"

export function useStaffUploadParticipantSummary() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

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

    if (existingParticipant && selectedCompetitionClass && selectedDeviceGroup) {
      return {
        reference: normalizeParticipantReference(existingParticipant.reference),
        firstName: existingParticipant.firstname,
        lastName: existingParticipant.lastname,
        email: existingParticipant.email ?? "",
        competitionClassName: selectedCompetitionClass.name,
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
        competitionClassName: selectedCompetitionClass.name,
        deviceGroupName: selectedDeviceGroup.name,
        statusLabel: "Manual entry",
        statusTone: "default" as const,
      }
    }

    return null
  }, [
    marathon.competitionClasses,
    marathon.deviceGroups,
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
