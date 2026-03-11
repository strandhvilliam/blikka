"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";

import { PrimaryButton } from "@/components/ui/primary-button";
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
    <div className="space-y-5">
      <ParticipantSummaryCard {...participantSummary} statusTone="success" />

      <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50/50 px-8 py-14 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-rocgrotesk text-3xl leading-none text-emerald-950">
          Upload complete
        </h2>
        <p className="mt-3 max-w-sm text-sm text-emerald-800">
          All files uploaded for participant #{participantSummary.reference}.
          Ready for the next SD card.
        </p>
        <PrimaryButton
          type="button"
          className="mt-8 rounded-full bg-emerald-700 px-8 py-4 text-base hover:bg-emerald-800"
          onClick={onResetAction}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Next participant
        </PrimaryButton>
      </div>
    </div>
  );
}
