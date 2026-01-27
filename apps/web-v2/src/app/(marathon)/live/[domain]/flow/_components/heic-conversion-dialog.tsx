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
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface HeicConversionDialogProps {
  open: boolean;
  isConverting: boolean;
  isCancelling: boolean;
  progress: {
    current: number;
    total: number;
  };
  currentFileName: string | null;
  onCancel: () => void;
}

export function HeicConversionDialog({
  open,
  isConverting,
  isCancelling,
  progress,
  currentFileName,
  onCancel,
}: HeicConversionDialogProps) {
  const t = useTranslations("FlowPage.uploadStep");

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-rocgrotesk">{t("convertingHeic")}</DialogTitle>
          <DialogDescription>
            {isCancelling
              ? t("cancelling")
              : t("conversionProgress", {
                  current: progress.current,
                  total: progress.total,
                  fileName: currentFileName || "",
                })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div className="text-sm text-muted-foreground">
            {isCancelling
              ? t("stoppingConversion")
              : t("convertingFile", {
                  current: progress.current,
                  total: progress.total,
                })}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isCancelling}
          >
            {t("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
