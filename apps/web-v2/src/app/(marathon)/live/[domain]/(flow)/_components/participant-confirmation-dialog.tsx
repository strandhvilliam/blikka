"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/ui/primary-button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

interface ParticipantConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  expectedParticipantRef: string;
}

export function formatParticipantRefForDisplay(
  ref: string | undefined | null,
): string {
  if (!ref) return "";
  return ref.replace(/^0+/, "") || "0";
}

export function ParticipantConfirmationDialog({
  open,
  onClose,
  onConfirm,
  expectedParticipantRef,
}: ParticipantConfirmationDialogProps) {
  const [enteredRef, setEnteredRef] = useState("");
  const [showError, setShowError] = useState(false);
  const t = useTranslations("FlowPage.participantConfirmation");

  useEffect(() => {
    if (open) {
      setEnteredRef("");
      setShowError(false);
    }
  }, [open]);

  const handleSubmit = () => {
    if (
      enteredRef.trim().padStart(4, "0") ===
      expectedParticipantRef.padStart(4, "0")
    ) {
      setShowError(false);
      onConfirm();
    } else {
      setShowError(true);
    }
  };

  const handleCancel = () => {
    setEnteredRef("");
    setShowError(false);
    onClose();
  };

  const handleInputChange = (value: string) => {
    setEnteredRef(value);
    if (showError) {
      setShowError(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-transparent border-none shadow-none top-[40%]"
      >
        <DialogHeader className="text-center flex flex-col items-center">
          <DialogTitle className="text-lg font-bold mb-2 text-foreground drop-shadow-sm">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/90 text-center font-medium drop-shadow-sm">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Input
            autoFocus
            type="text"
            inputMode="numeric"
            value={enteredRef}
            onChange={(e) => handleInputChange(e.target.value)}
            className={cn(
              "text-center !text-4xl h-16 font-bold font-mono tracking-widest bg-background",
              showError && "border-red-500 focus-visible:ring-red-500",
            )}
            placeholder={formatParticipantRefForDisplay(expectedParticipantRef)}
            maxLength={4}
            enterKeyHint="done"
          />

          {showError && (
            <div className="flex items-center justify-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{t("mismatch")}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              className="flex-1 h-12 rounded-full"
            >
              {t("cancel")}
            </Button>
            <PrimaryButton
              type="button"
              disabled={!enteredRef.trim()}
              onClick={handleSubmit}
              className="flex-1 h-12 text-base font-medium rounded-full"
            >
              {t("confirmUpload")}
            </PrimaryButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
