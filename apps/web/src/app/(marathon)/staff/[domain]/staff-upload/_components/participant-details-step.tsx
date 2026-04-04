"use client"

import { CheckCircle2 } from "lucide-react"
import { motion } from "motion/react"
import { Icon } from "@iconify/react"
import type { CompetitionClass, DeviceGroup } from "@blikka/db"

import { Input } from "@/components/ui/input"
import { Card, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getSelectedTopics } from "@/lib/upload-utils"
import { useStaffUploadStore } from "../_lib/staff-upload-store"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { UploadMarathonMode } from "@/lib/types"

interface ParticipantDetailsStepProps {
  isBusy: boolean
}

function CompetitionClassCard({
  competitionClass,
  isSelected,
  disabled,
  onSelect,
}: {
  competitionClass: CompetitionClass
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <motion.div whileTap={disabled ? undefined : { scale: 0.97 }}>
      <Card
        className={cn(
          "relative cursor-pointer overflow-hidden py-0 transition-all duration-200",
          isSelected && "ring-2 ring-primary/20 shadow-md",
          disabled && "pointer-events-none opacity-60",
        )}
        onClick={onSelect}
      >
        <div className={cn("flex items-center gap-4 px-4 py-3", isSelected && "bg-foreground/3")}>
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
              isSelected ? "bg-primary/10" : "bg-muted/50",
            )}
          >
            <span
              className={cn(
                "text-2xl font-bold transition-colors duration-200",
                isSelected ? "text-primary" : "text-foreground/80",
              )}
            >
              {competitionClass.numberOfPhotos}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="truncate">{competitionClass.name}</span>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: isSelected ? 1 : 0,
                  opacity: isSelected ? 1 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </motion.div>
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {competitionClass.numberOfPhotos === 1
                ? "1 photo"
                : `${competitionClass.numberOfPhotos} photos`}
              {competitionClass.description ? ` · ${competitionClass.description}` : ""}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function DeviceGroupCard({
  deviceGroup,
  isSelected,
  disabled,
  onSelect,
}: {
  deviceGroup: DeviceGroup
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <motion.div whileTap={disabled ? undefined : { scale: 0.97 }}>
      <Card
        className={cn(
          "relative cursor-pointer overflow-hidden py-0 transition-all duration-200",
          isSelected && "ring-2 ring-primary/20 shadow-md",
          disabled && "pointer-events-none opacity-60",
        )}
        onClick={onSelect}
      >
        <div className={cn("flex items-center gap-4 px-4 py-3", isSelected && "bg-foreground/3")}>
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
              isSelected ? "bg-primary/10" : "bg-muted/50",
            )}
          >
            <span
              className={cn(
                "transition-colors duration-200",
                isSelected ? "text-primary" : "text-foreground/80",
              )}
            >
              {deviceGroup.icon === "smartphone" ? (
                <Icon icon="solar:smartphone-broken" className="h-8 w-8" />
              ) : (
                <Icon icon="solar:camera-minimalistic-broken" className="h-8 w-8" />
              )}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="truncate">{deviceGroup.name}</span>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: isSelected ? 1 : 0,
                  opacity: isSelected ? 1 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </motion.div>
            </CardTitle>
            {deviceGroup.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{deviceGroup.description}</p>
            ) : null}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export function ParticipantDetailsStep({ isBusy }: ParticipantDetailsStepProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const reference = useStaffUploadStore((state) => state.formValues.reference)
  const values = useStaffUploadStore((state) => state.formValues)
  const errors = useStaffUploadStore((state) => state.formErrors)
  const setFormField = useStaffUploadStore((state) => state.setFormField)

  const marathonMode = marathon.mode as UploadMarathonMode
  const sortedTopics = marathon.topics.toSorted((a, b) => a.orderIndex - b.orderIndex)
  const activeByCameraTopic = sortedTopics.find((topic) => topic.visibility === "active") ?? null
  const selectedCompetitionClass =
    marathon.competitionClasses.find((cc) => cc.id === Number(values.competitionClassId)) ?? null
  const selectedTopics = getSelectedTopics(
    marathonMode,
    activeByCameraTopic,
    selectedCompetitionClass,
    sortedTopics,
  )

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Participant #
          {reference.trim() ? reference : marathonMode === "by-camera" ? "new" : "—"}
        </p>
        <h2 className="mt-2 font-gothic text-3xl font-medium leading-none tracking-tight text-foreground">
          Fill in details
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {marathonMode === "by-camera"
            ? "No existing record was found for this phone. Enter their name, email, and the device they used."
            : "This participant was not prepared beforehand. Enter their name, email, and select class and device below."}
        </p>
      </div>

      {marathonMode === "by-camera" && !activeByCameraTopic ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          There is no active topic for this event. Staff cannot upload until a topic is activated in
          the dashboard.
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">First name</label>
            <Input
              value={values.firstName}
              onChange={(event) => setFormField("firstName", event.target.value)}
              placeholder="James"
              autoCapitalize="words"
              enterKeyHint="next"
              className={cn(
                "h-12 rounded-xl text-base",
                errors.firstName && "border-rose-400 focus-visible:ring-rose-400",
              )}
            />
            {errors.firstName ? <p className="text-sm text-rose-600">{errors.firstName}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Last name</label>
            <Input
              value={values.lastName}
              onChange={(event) => setFormField("lastName", event.target.value)}
              placeholder="Bond"
              autoCapitalize="words"
              enterKeyHint="next"
              className={cn(
                "h-12 rounded-xl text-base",
                errors.lastName && "border-rose-400 focus-visible:ring-rose-400",
              )}
            />
            {errors.lastName ? <p className="text-sm text-rose-600">{errors.lastName}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email</label>
          <Input
            value={values.email}
            onChange={(event) => setFormField("email", event.target.value)}
            placeholder="participant@example.com"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            className={cn(
              "h-12 rounded-xl text-base",
              errors.email && "border-rose-400 focus-visible:ring-rose-400",
            )}
          />
          {errors.email ? <p className="text-sm text-rose-600">{errors.email}</p> : null}
        </div>

        {marathonMode === "by-camera" ? (
          <div className="space-y-1 rounded-xl border border-border bg-muted/30 px-4 py-3 text-left">
            <p className="text-sm font-medium text-foreground">Phone number</p>
            <p className="text-base text-foreground">{values.phone.trim() || "—"}</p>
            {errors.phone ? <p className="text-sm text-rose-600">{errors.phone}</p> : null}
          </div>
        ) : null}
      </div>

      {marathonMode === "marathon" ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Competition class</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              How many photos is this participant submitting?
            </p>
          </div>
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {marathon.competitionClasses.map((competitionClass) => (
                <CompetitionClassCard
                  key={competitionClass.id}
                  competitionClass={competitionClass}
                  isSelected={values.competitionClassId === String(competitionClass.id)}
                  disabled={isBusy}
                  onSelect={() => setFormField("competitionClassId", String(competitionClass.id))}
                />
              ))}
            </div>
            {errors.competitionClassId ? (
              <p className="text-sm text-rose-600">{errors.competitionClassId}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Device</p>
          <p className="mt-0.5 text-sm text-muted-foreground">What did they shoot with?</p>
        </div>
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {marathon.deviceGroups.map((deviceGroup) => (
              <DeviceGroupCard
                key={deviceGroup.id}
                deviceGroup={deviceGroup}
                isSelected={values.deviceGroupId === String(deviceGroup.id)}
                disabled={isBusy}
                onSelect={() => setFormField("deviceGroupId", String(deviceGroup.id))}
              />
            ))}
          </div>
          {errors.deviceGroupId ? (
            <p className="text-sm text-rose-600">{errors.deviceGroupId}</p>
          ) : null}
        </div>
      </div>

      {selectedTopics.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Photo order ({selectedTopics.length} {selectedTopics.length === 1 ? "topic" : "topics"})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedTopics.map((topic) => (
              <div
                key={topic.id}
                className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground"
              >
                #{topic.orderIndex + 1} {topic.name}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
