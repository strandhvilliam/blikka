"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  Loader2,
  Trash2Icon,
  AlertTriangle,
  XCircle,
} from "lucide-react";

import { Button } from "@vimmer/ui/components/button";
import { PrimaryButton } from "@vimmer/ui/components/primary-button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@vimmer/ui/components/alert-dialog";
import { Input } from "@vimmer/ui/components/input";
import { useI18n } from "@/locales/client";
import { geistMono } from "@/lib/fonts";
import { toast } from "sonner";
import {
  CompetitionClass,
  DeviceGroup,
  Participant,
  Submission,
  Topic,
  ValidationResult,
} from "@vimmer/api/db/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { PreviewDialog } from "./preview-dialog";
import { DrawerLayout } from "./drawer-layout";
import { ValidationAccordion } from "./validation-accordion";
import { cn } from "@vimmer/ui/lib/utils";

interface ParticipantInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participant:
  | (Participant & {
    validationResults: ValidationResult[];
    competitionClass: CompetitionClass | null;
    deviceGroup: DeviceGroup | null;
    submissions: Submission[];
  })
  | null;
  participantLoading: boolean;
  onParticipantVerified?: () => void;
  topics: Topic[];
  baseThumbnailUrl: string;
  submissionBaseUrl: string;
  previewBaseUrl: string;
}

export function ParticipantInfoSheet({
  open,
  onOpenChange,
  participant,
  participantLoading,
  onParticipantVerified,
  topics,
  baseThumbnailUrl,
  submissionBaseUrl,
  previewBaseUrl,
}: ParticipantInfoSheetProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const t = useI18n();

  const { mutate: verifyParticipant, isPending: isVerifying } = useMutation(
    trpc.validations.createParticipantVerification.mutationOptions({
      onSuccess: () => {
        toast.success("Participant verified successfully");
        onOpenChange(false);
        onParticipantVerified?.();
      },
      onError: (error) => {
        console.error("Error verifying participant:", error);
        toast.error("Failed to verify participant");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.participants.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.validations.pathKey(),
        });
      },
    }),
  );

  const { mutate: rejectParticipant, isPending: isRejecting } = useMutation(
    trpc.participants.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Participant rejected");
        setRejectDialogOpen(false);
        onOpenChange(false);
      },
      onError: (error) => {
        console.error("Error rejecting participant:", error);
        toast.error("Failed to reject participant");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.participants.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.validations.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.submissions.pathKey(),
        });
      },
    }),
  );

  const {
    mutate: updateValidationResult,
    isPending: isUpdatingValidationResult,
  } = useMutation(
    trpc.validations.updateValidationResult.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey:
            trpc.validations.getValidationResultsByParticipantId.queryKey({
              participantId: participant?.id,
            }),
        });
      },
      onError: (error) => {
        console.error("Error overruling validation:", error);
        toast.error("Failed to overrule validation");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.validations.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.participants.pathKey(),
        });
      },
    }),
  );

  // Keeping validation runner available for future use, not currently rendered
  // Validation runner kept for potential future use

  const hasOverrulableErrors = participant?.validationResults.some(
    (v) => v.severity === "error" && v.outcome === "failed" && !v.overruled,
  );

  const renderParticipantLoading = () => (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted/40 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">
            Loading Participant Information
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Please wait while we load the participant information
          </p>
        </div>
      </div>
    </div>
  );

  const renderParticipantNotFound = () => (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted/40 flex items-center justify-center">
          <XCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground">
            Participant Not Found
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            The selected participant could not be loaded. Please try selecting a
            different participant or refresh the page.
          </p>
        </div>
      </div>
    </div>
  );

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [confirmReference, setConfirmReference] = useState("");
  const [showRejectError, setShowRejectError] = useState(false);

  useEffect(() => {
    if (!rejectDialogOpen) {
      setConfirmReference("");
      setShowRejectError(false);
    }
  }, [rejectDialogOpen]);

  const renderParticipant = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-6 pb-3 flex justify-center">
        <div className="flex flex-col flex-0 items-center">
          <span className="text-4xl font-bold font-rocgrotesk">
            #{participant?.reference}
          </span>
          <div className="h-1 w-full bg-vimmer-primary" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex flex-col items-center gap-2 rounded-xl py-2 px-3">
          <div className="text-center">
            <div className="text-lg font-medium text-foreground">
              {participant?.firstname} {participant?.lastname}
            </div>
            {participant?.email && (
              <div className="text-sm text-muted-foreground ">
                {participant?.email}
              </div>
            )}
          </div>
          <div className="flex gap-2 w-full justify-center">
            <div
              className={cn(
                "flex items-center space-x-2 text-sm border rounded-full px-3 py-1",
                participant?.status === "verified"
                  ? "bg-green-100 border-green-400"
                  : "bg-amber-100 border-amber-400",
              )}
            >
              {participant?.status === "verified" ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Verified</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-amber-600">
                  <XCircle className="h-4 w-4" />
                  <span className="font-bold">Not Verified</span>
                </div>
              )}
            </div>

            {/* <Button
              variant="outline"
              size="sm"
              className="text-xs px-2 py-1 h-8 rounded-full border-muted-foreground/40 !bg-background"
              onClick={() => {
                if (!participant) return
                runValidations({ participantId: participant.id })
              }}
              disabled={isRunningValidations}
            >
              {isRunningValidations ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Run Validations
            </Button> */}

            <AlertDialog
              open={rejectDialogOpen}
              onOpenChange={(open) => {
                setRejectDialogOpen(open);
                if (!open) {
                  setConfirmReference("");
                  setShowRejectError(false);
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-xs px-2 py-1 h-8 rounded-full border-muted-foreground/40 !bg-background"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={!participant || isRejecting}
                >
                  <Trash2Icon className="h-4 w-4" />
                  Reject Participant
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-transparent border-none shadow-none top-[40%]">
                <AlertDialogHeader className="text-center flex flex-col items-center">
                  <AlertDialogTitle className="text-lg font-medium mb-2">
                    Confirm Rejection
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground text-center">
                    To reject, enter the participant number. The participant
                    will then have to redo the submission flow from the
                    beginning.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <form
                  className="flex flex-col gap-4 py-4"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <Input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    value={confirmReference}
                    onChange={(e) => {
                      setConfirmReference(e.target.value);
                      if (showRejectError) setShowRejectError(false);
                    }}
                    className={cn(
                      "text-center !text-4xl h-16 font-bold font-mono tracking-widest",
                      geistMono.className,
                      showRejectError &&
                      "border-red-500 focus-visible:ring-red-500",
                    )}
                    placeholder={
                      participant?.reference
                        ? String(participant.reference)
                        : "0000"
                    }
                    enterKeyHint="done"
                  />

                  {showRejectError && (
                    <div className="flex items-center justify-center gap-2 text-red-600 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{t("participantConfirmation.mismatch")}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        setConfirmReference("");
                        setShowRejectError(false);
                        setRejectDialogOpen(false);
                      }}
                      variant="outline"
                      className="flex-1 h-12 rounded-full"
                    >
                      {t("participantConfirmation.cancel")}
                    </Button>
                    <PrimaryButton
                      type="submit"
                      disabled={!confirmReference.trim() || isRejecting}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!participant) return;
                        if (
                          confirmReference.trim() !==
                          String(participant.reference).trim()
                        ) {
                          setShowRejectError(true);
                          return;
                        }
                        rejectParticipant({
                          id: participant.id,
                        });
                      }}
                      className="flex-1 h-12 text-base font-medium rounded-full"
                    >
                      {isRejecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Confirm"
                      )}
                    </PrimaryButton>
                  </div>
                </form>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="space-y-2 pt-2">
          {participant && (
            <ValidationAccordion
              validationResults={participant.validationResults}
              submissions={participant.submissions}
              topics={topics}
              competitionClass={participant.competitionClass}
              baseThumbnailUrl={baseThumbnailUrl}
              submissionBaseUrl={submissionBaseUrl}
              previewBaseUrl={previewBaseUrl}
              onThumbnailClick={(url) => {
                setImageDialogOpen(true);
                setSelectedImageUrl(url);
              }}
              onOverrule={(validationId) =>
                updateValidationResult({
                  id: validationId,
                  data: {
                    overruled: true,
                  },
                })
              }
              isOverruling={isUpdatingValidationResult}
              showOverruleButtons={true}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t  bg-background/80 backdrop-blur-sm px-4 py-4 flex justify-center">
        <PrimaryButton
          onClick={() => {
            if (!participant) return;

            if (hasOverrulableErrors) {
              const failedErrorValidations =
                participant.validationResults.filter(
                  (v) =>
                    v.severity === "error" &&
                    v.outcome === "failed" &&
                    !v.overruled,
                );

              failedErrorValidations.forEach((validation) => {
                updateValidationResult({
                  id: validation.id,
                  data: {
                    overruled: true,
                  },
                });
              });

              setTimeout(() => {
                verifyParticipant({
                  data: {
                    participantId: participant.id,
                    staffId: "1",
                    notes: "",
                  },
                });
              }, 100);
            } else {
              verifyParticipant({
                data: {
                  participantId: participant.id,
                  staffId: "1",
                  notes: "",
                },
              });
            }
          }}
          disabled={
            participant?.status === "verified" ||
            isVerifying ||
            isUpdatingValidationResult
          }
          className="w-full max-w-sm p-4 text-base shadow-sm rounded-full"
        >
          {isVerifying || isUpdatingValidationResult ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : participant?.status === "verified" ? (
            "Already Verified"
          ) : hasOverrulableErrors ? (
            "Overrule all and verify"
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Verify Participant
            </div>
          )}
        </PrimaryButton>
      </div>
    </div>
  );

  return (
    <>
      <DrawerLayout
        open={open}
        onOpenChange={onOpenChange}
        title="Participant Information"
      >
        {participantLoading
          ? renderParticipantLoading()
          : participant
            ? renderParticipant()
            : renderParticipantNotFound()}
      </DrawerLayout>
      <PreviewDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        imageUrl={selectedImageUrl}
      />
    </>
  );
}
