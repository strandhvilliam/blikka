"use client";

import type { CompetitionClass, DeviceGroup, Topic } from "@blikka/db";

import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ParticipantDetailsForm } from "@/components/participant-upload/participant-details-form";
import { UploadMappingSection } from "@/components/participant-upload/upload-mapping-section";
import type { ParticipantUploadFormApi } from "@/hooks/use-participant-upload-form";

interface ParticipantDetailsStepProps {
  form: ParticipantUploadFormApi;
  competitionClasses: CompetitionClass[];
  deviceGroups: DeviceGroup[];
  selectedTopics: Topic[];
  isBusy: boolean;
  onBackAction: () => void;
  onContinueAction: () => void;
}

export function ParticipantDetailsStep({
  form,
  competitionClasses,
  deviceGroups,
  selectedTopics,
  isBusy,
  onBackAction,
  onContinueAction,
}: ParticipantDetailsStepProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-[#ddd8ca] bg-white/92 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a7566]">
            Step 2
          </p>
          <h2 className="mt-3 font-rocgrotesk text-4xl leading-none text-[#1d1b17]">
            Enter participant details
          </h2>
          <p className="mt-3 max-w-xl text-sm text-[#666152]">
            This participant was not prepared earlier, so staff needs to enter
            the participant details and upload mapping before selecting photos.
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

      <aside className="rounded-[2rem] border border-[#ddd8ca] bg-[linear-gradient(180deg,#1c1915,#2e2820)] p-8 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">
          Checklist
        </p>
        <div className="mt-5 space-y-4 text-sm text-white/75">
          <p>Reference should match the participant desk card.</p>
          <p>Competition class controls the exact number of required photos.</p>
          <p>Device group is required before file selection is enabled.</p>
          <p>Files will later be sorted by EXIF timestamp and mapped to topics.</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            onClick={onBackAction}
            disabled={isBusy}
          >
            Back
          </Button>
          <PrimaryButton
            type="button"
            className="rounded-full bg-white text-[#16130f] hover:bg-white/95"
            onClick={onContinueAction}
            disabled={isBusy}
          >
            Continue to upload
          </PrimaryButton>
        </div>
      </aside>
    </section>
  );
}

