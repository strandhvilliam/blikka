/**
 * Single-key shortcuts must not fire while the juror is typing, and must not fight a modal that
 * already owns the keyboard — a dialog's Escape would otherwise also close the view behind it.
 */
export function isShortcutBlockedTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return true
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  return Boolean(target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]'))
}
