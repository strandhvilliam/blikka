"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { CompetitionClass, DeviceGroup, Topic } from "@blikka/db"
import { pluralizePhotos, type ParticipantUploadFormApi } from "@/hooks/use-participant-upload-form"

interface UploadMappingSectionProps {
  form: ParticipantUploadFormApi
  marathonMode: string
  competitionClasses: CompetitionClass[]
  deviceGroups: DeviceGroup[]
  selectedTopics: Topic[]
  isBusy: boolean
}

export function UploadMappingSection({
  form,
  marathonMode,
  competitionClasses,
  deviceGroups,
  selectedTopics,
  isBusy,
}: UploadMappingSectionProps) {
  return (
    <section className="rounded-xl border border-[#e2e2d8] bg-white p-5 shadow-sm">
      <h3 className="font-gothic text-lg text-[#1f1f1f]">Upload Mapping</h3>
      <p className="mt-1 text-sm text-[#66665f]">
        Files are sorted by EXIF timestamp before being mapped to topic order.
      </p>

      <div className="mt-4 space-y-4">
        <div
          className={cn(
            "grid gap-4",
            marathonMode === "marathon" ? "md:grid-cols-2" : "grid-cols-1",
          )}
        >
          {marathonMode === "marathon" ? (
            <form.Field name="competitionClassId">
              {(field) => (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                    Competition Class
                  </label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value)}
                    disabled={isBusy}
                  >
                    <SelectTrigger
                      className={cn(
                        !field.state.meta.isValid &&
                          field.state.meta.isTouched &&
                          "border-rose-400 focus-visible:ring-rose-400",
                      )}
                    >
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {competitionClasses.map((competitionClass) => (
                        <SelectItem
                          key={competitionClass.id}
                          value={competitionClass.id.toString()}
                        >
                          {competitionClass.name} (
                          {pluralizePhotos(competitionClass.numberOfPhotos)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!field.state.meta.isValid &&
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 ? (
                    <p className="text-xs text-rose-600">{field.state.meta.errors.join(", ")}</p>
                  ) : null}
                </div>
              )}
            </form.Field>
          ) : null}

          <form.Field name="deviceGroupId">
            {(field) => (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                  Device Group
                </label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value)}
                  disabled={isBusy}
                >
                  <SelectTrigger
                    className={cn(
                      !field.state.meta.isValid &&
                        field.state.meta.isTouched &&
                        "border-rose-400 focus-visible:ring-rose-400",
                    )}
                  >
                    <SelectValue placeholder="Select device group" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!field.state.meta.isValid &&
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0 ? (
                  <p className="text-xs text-rose-600">{field.state.meta.errors.join(", ")}</p>
                ) : null}
              </div>
            )}
          </form.Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
            Topic Mapping
          </p>
          {selectedTopics.length === 0 ? (
            <p className="text-sm text-[#6a6a63]">No topics available for current selection.</p>
          ) : (
            <div className="space-y-2">
              {selectedTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between rounded-md border border-[#e1e1d8] bg-[#fcfcf9] px-3 py-2 text-sm"
                >
                  <span className="text-[#2f2f28]">
                    #{topic.orderIndex + 1} {topic.name}
                  </span>
                  <span className="text-xs text-[#7a7a71]">orderIndex {topic.orderIndex}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
