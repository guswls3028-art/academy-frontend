import { useEffect, type RefObject } from "react";

/** Keep signup keyboard navigation local while allowing the final confirmation above it. */
export function useSignupDialogFocus(
  open: boolean,
  dialogRef: RefObject<HTMLDivElement | null>,
  initialFocusRef: RefObject<HTMLInputElement | null>,
  onClose: () => Promise<void>,
) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        void onClose();
      } else if (event.key === "Tab") {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
        ) ?? []).filter((item) => item.getClientRects().length > 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (!dialogRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogRef, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    initialFocusRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [initialFocusRef, open]);
}
