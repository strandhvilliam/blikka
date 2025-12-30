"use client";

import type {
  Participant,
  CompetitionClass,
  DeviceGroup,
  Submission,
} from "@blikka/db";
import { Card, CardContent } from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Upload,
  Loader2,
} from "lucide-react";

interface ParticipantStatusIndicatorProps {
  participant: Participant & {
    competitionClass: CompetitionClass | null;
    deviceGroup: DeviceGroup | null;
    submissions?: Submission[];
  };
}

export function ParticipantStatusIndicator({
  participant,
}: ParticipantStatusIndicatorProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "initialized":
        return {
          icon: <Clock className="h-5 w-5" />,
          label: "Initialized",
          description: "Participant has been created but not started",
          color: "text-gray-600",
          bgColor: "bg-gray-100",
          borderColor: "border-gray-200",
        };
      case "ready_to_upload":
        return {
          icon: <Upload className="h-5 w-5" />,
          label: "Ready to Upload",
          description: "Participant can start uploading photos",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
        };
      case "processing":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin" />,
          label: "Processing",
          description: "Photos are being processed and validated",
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
        };
      case "completed":
        return {
          icon: <Shield className="h-5 w-5" />,
          label: "Submitted",
          description: "All photos uploaded, awaiting staff verification",
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
        };
      case "verified":
        return {
          icon: <CheckCircle className="h-5 w-5" />,
          label: "Verified",
          description: "Submission has been uploaded and verified",
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      default:
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          label: status,
          description: "Unknown status",
          color: "text-gray-600",
          bgColor: "bg-gray-100",
          borderColor: "border-gray-200",
        };
    }
  };

  const statusConfig = getStatusConfig(participant.status);

  return (
    <div
      className={cn(
        "border-2 items-center flex rounded-lg min-w-[260px]",
        statusConfig.borderColor,
        statusConfig.bgColor,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn("p-2 rounded-lg bg-muted border", statusConfig.color)}
          >
            {statusConfig.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn("font-semibold text-sm", statusConfig.color)}>
              <span className="font-normal text-muted-foreground">Status:</span>{" "}
              {statusConfig.label}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {statusConfig.description}
            </p>
            {participant.status === "processing" && (
              <PrimaryButton
                className="mt-1 w-fit h-8 text-xs"
                onClick={() => {}}
              >
                <Shield className="h-3.5 w-3.5" />
                Mark as completed
              </PrimaryButton>
            )}
            {participant.status === "completed" && (
              <PrimaryButton
                className="mt-1 w-fit h-8 text-xs"
                onClick={() => {}}
              >
                <Shield className="h-3.5 w-3.5" />
                Verify Now
              </PrimaryButton>
            )}
          </div>
        </div>
      </CardContent>
    </div>
  );
}
