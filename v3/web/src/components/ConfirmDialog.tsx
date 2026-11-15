import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";

// Asks before an action that can't be taken back from the website. The dialog closes once
// onConfirm resolves, and shows `failure` if it rejects.
export function ConfirmDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  action,
  onConfirm,
  failure,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  action: string;
  onConfirm: () => Promise<T>;
  failure: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        setError(undefined);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);

              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                setError(failure);
              }

              setBusy(false);
            }}
          >
            {action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
