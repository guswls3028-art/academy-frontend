import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/shared/utils/safeSessionStorage";

const PROMPT_KEY = "staff.clock-in-choice.pending.v1";
const PROMPT_EVENT = "staff-clock-in-choice:changed";

function notifyPromptChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROMPT_EVENT));
  }
}

export function markStaffClockInChoicePending() {
  setSessionItem(PROMPT_KEY, String(Date.now()));
  notifyPromptChanged();
}

export function clearStaffClockInChoicePending() {
  removeSessionItem(PROMPT_KEY);
  notifyPromptChanged();
}

export function hasPendingStaffClockInChoice(): boolean {
  return getSessionItem(PROMPT_KEY) != null;
}

export function subscribeStaffClockInChoice(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(PROMPT_EVENT, listener);
  return () => window.removeEventListener(PROMPT_EVENT, listener);
}
