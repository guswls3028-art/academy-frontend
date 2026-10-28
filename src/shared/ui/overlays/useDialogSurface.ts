import { useEffect, useRef, type RefObject } from "react";
import { lockBodyScroll } from "./bodyScrollLock";

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
const openDialogStack: HTMLElement[] = [];
let triggerObservers = 0;
let pointerTrigger: { element: HTMLElement; time: number } | null = null;

function recordPointerTrigger(event: PointerEvent) {
  const element = event.target instanceof Element
    ? event.target.closest<HTMLElement>('button, a[href], [role="button"], [aria-haspopup]')
    : null;
  pointerTrigger = element ? { element, time: performance.now() } : null;
}

function clearPointerTrigger() { pointerTrigger = null; }

function observeDialogTriggers() {
  if (triggerObservers++ === 0) {
    document.addEventListener("pointerdown", recordPointerTrigger, true);
    document.addEventListener("keydown", clearPointerTrigger, true);
  }
  return () => {
    if (--triggerObservers !== 0) return;
    document.removeEventListener("pointerdown", recordPointerTrigger, true);
    document.removeEventListener("keydown", clearPointerTrigger, true);
    clearPointerTrigger();
  };
}

function isVisibleFocusable(element: HTMLElement) {
  if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && element.getClientRects().length > 0;
}

function getFocusableElements(sheet: HTMLElement) {
  return [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisibleFocusable);
}

export function useDialogSurface(open: boolean, dialogRef: RefObject<HTMLElement | null>, onClose: () => void, initialFocusRef?: RefObject<HTMLElement | null>) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(observeDialogTriggers, []);

  useEffect(() => {
    if (!open) return;
    const sheet = dialogRef.current;
    if (!sheet) return;
    openDialogStack.push(sheet);
    // Safari does not focus pointer-activated buttons. Preserve that trigger
    // without changing the browser's normal pointer/focus behavior elsewhere.
    triggerRef.current = pointerTrigger?.element.isConnected && performance.now() - pointerTrigger.time < 1000
      ? pointerTrigger.element
      : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlockBodyScroll = lockBodyScroll();
    const focusFrame = requestAnimationFrame(() => {
      // A keyboard user may have focused a control before this frame runs.
      if (sheet.contains(document.activeElement) && document.activeElement !== sheet) return;
      const requestedTarget = initialFocusRef?.current;
      const target = requestedTarget && isVisibleFocusable(requestedTarget)
        ? requestedTarget
        : getFocusableElements(sheet)[0] ?? sheet;
      target?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogStack[openDialogStack.length - 1] !== sheet) return;
      if (event.defaultPrevented || event.isComposing || document.querySelector("[data-confirm-dialog]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(sheet);
      if (focusable.length === 0) {
        event.preventDefault();
        sheet.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!sheet.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      const stackIndex = openDialogStack.lastIndexOf(sheet);
      if (stackIndex >= 0) openDialogStack.splice(stackIndex, 1);
      unlockBodyScroll();
      const trigger = triggerRef.current;
      requestAnimationFrame(() => {
        const top = openDialogStack[openDialogStack.length - 1];
        if (trigger?.isConnected && (!top || top.contains(trigger)) && !document.querySelector("[data-confirm-dialog]")) {
          trigger.focus({ preventScroll: true });
        }
      });
    };
  }, [dialogRef, initialFocusRef, open]);

}
