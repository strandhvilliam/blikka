"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";

import { PrimaryButton } from "@/components/ui/primary-button";
import { Button } from "@/components/ui/button";
import { ParticipantSummaryCard } from "./participant-summary-card";

interface UploadCompletePanelProps {
  participantSummary: {
    reference: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    competitionClassName: string;
    deviceGroupName: string;
    statusLabel: string;
    statusTone?: "default" | "warning" | "success";
  };
  onResetAction: () => void;
}

export function UploadCompletePanel({
  participantSummary,
  onResetAction,
}: UploadCompletePanelProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <ParticipantSummaryCard {...participantSummary} statusTone="success" />

      <div className="rounded-[2rem] border border-emerald-200 bg-[linear-gradient(180deg,#f5fff7,#eefbf1)] p-8 shadow-sm">
        <div className="inline-flex rounded-full border border-emerald-200 bg-white px-4 py-2 text-emerald-700">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Upload completed
        </div>

        <h2 className="mt-6 font-rocgrotesk text-5xl leading-none text-[#14311c]">
          Participant ready
        </h2>
        <p className="mt-4 max-w-xl text-sm text-[#33533c]">
          All required files were uploaded and finalized for participant #
          {participantSummary.reference}. The desk is ready for the next SD card.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <PrimaryButton
            type="button"
            className="rounded-full bg-[#1b4c2b] hover:bg-[#163f24]"
            onClick={onResetAction}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Next participant
          </PrimaryButton>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
            onClick={onResetAction}
          >
            Start over
          </Button>
        </div>
      </div>
    </section>
  );
}

