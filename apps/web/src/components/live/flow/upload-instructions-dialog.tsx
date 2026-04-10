"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useTranslations } from "next-intl";

interface UploadInstructionsDialogProps {
  open: boolean;
  onUnderstand: () => void;
}

export function UploadInstructionsDialog({
  open,
  onUnderstand,
}: UploadInstructionsDialogProps) {
  const t = useTranslations("FlowPage.uploadStep");

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-gothic text-xl font-medium tracking-tight">
            {t("uploadInstructionsTitle")}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-2 text-left text-sm text-muted-foreground">
              <p>{t("uploadInstructionsIntro")}</p>
              <div>
                <p className="mb-2 font-medium text-foreground">
                  {t("uploadInstructionsAvoidTitle")}
                </p>
                <ul className="list-disc space-y-2 pl-4">
                  <li>{t("uploadInstructionsAvoidCloud")}</li>
                  <li>{t("uploadInstructionsAvoidMessaging")}</li>
                </ul>
              </div>
              <p>{t("uploadInstructionsPrefer")}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-stretch">
          <PrimaryButton
            type="button"
            className="w-full rounded-full py-3"
            onClick={onUnderstand}
          >
            {t("uploadInstructionsUnderstand")}
          </PrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
