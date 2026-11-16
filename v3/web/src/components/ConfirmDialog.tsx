import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@ui-sdk/react/alert-dialog";

// Asks before an action that can't be taken back from the website. The dialog stays open while
// onConfirm runs, closes once it resolves, and shows `failure` if it rejects.
export function ConfirmDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  action,
  onConfirm,
  failure,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  action: string;
  onConfirm: () => Promise<T>;
  failure: string;
  // Where focus goes once it closes, for a dialog opened from a menu item that's gone by then.
  finalFocus?: () => HTMLElement | null;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogBackdrop />
      <AlertDialogContent finalFocus={finalFocus}>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <AlertDialogClose
          data-variant="destructive"
          data-agent-confirm={description}
          value="confirm"
          action={onConfirm}
          render={(props, state) => (
            <div className="flex flex-col gap-4">
              {state.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {failure}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <AlertDialogClose>Cancel</AlertDialogClose>
                <button {...props}>{action}</button>
              </div>
            </div>
          )}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
