function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getSessionItem(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setSessionItem(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch {
    // Storage can be blocked or full; session hints must never break the UI.
  }
}

export function removeSessionItem(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // Storage can be blocked; cleanup remains best-effort.
  }
}
