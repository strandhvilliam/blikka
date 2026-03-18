"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

interface UploadConfirmationDialogProps {
  open: boolean;
  isInitializing: boolean;
  participantRef?: string;
  numberOfPhotos: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function UploadConfirmationDialog({
  open,
  isInitializing,
  participantRef = "",
  numberOfPhotos,
  onOpenChange,
  onConfirm,
}: UploadConfirmationDialogProps) {
  const t = useTranslations("FlowPage.uploadStep");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isDisabled = isInitializing || isSubmitting;

  const handleConfirmClick = async () => {
    if (isSubmittingRef.current || isInitializing) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      await onConfirm();
    } finally {
      isSubmittingRef.current = false;

      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmUpload")}</DialogTitle>
          <DialogDescription>
            {participantRef
              ? t("confirmUploadDescription", {
                  ref: participantRef,
                  count: numberOfPhotos,
                })
              : t("confirmUploadDescriptionGeneric", {
                  count: numberOfPhotos,
                })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDisabled}
          >
            {t("cancel")}
          </Button>
          <PrimaryButton onClick={handleConfirmClick} disabled={isDisabled}>
            {isDisabled ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("initializing")}
              </>
            ) : (
              t("confirmAndUpload")
            )}
          </PrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
