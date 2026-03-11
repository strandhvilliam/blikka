"use client";

import type { CompetitionClass, DeviceGroup, Topic } from "@blikka/db";

import { ParticipantDetailsForm } from "@/components/participant-upload/participant-details-form";
import { UploadMappingSection } from "@/components/participant-upload/upload-mapping-section";
import type { ParticipantUploadFormApi } from "@/hooks/use-participant-upload-form";

interface ParticipantDetailsStepProps {
  form: ParticipantUploadFormApi;
  competitionClasses: CompetitionClass[];
  deviceGroups: DeviceGroup[];
  selectedTopics: Topic[];
  isBusy: boolean;
}

export function ParticipantDetailsStep({
  form,
  competitionClasses,
  deviceGroups,
  selectedTopics,
  isBusy,
}: ParticipantDetailsStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Manual entry
        </p>
        <h2 className="mt-2 font-rocgrotesk text-3xl leading-none text-foreground">
          Participant details
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This participant wasn&apos;t prepared beforehand. Fill in their details
          and select the upload mapping before continuing to photo selection.
        </p>
      </div>

      <ParticipantDetailsForm form={form} marathonMode="marathon" />

      <UploadMappingSection
        form={form}
        marathonMode="marathon"
        competitionClasses={competitionClasses}
        deviceGroups={deviceGroups}
        selectedTopics={selectedTopics}
        isBusy={isBusy}
      />
    </div>
  );
}
