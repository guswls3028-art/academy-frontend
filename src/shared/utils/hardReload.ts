const RELOAD_PARAM = "__hplus_reload";

type HardReloadOptions = {
  key: string;
  cooldownMs: number;
};

function getSessionNumber(key: string): number {
  try {
    return Number(sessionStorage.getItem(key) || "0");
  } catch {
    return 0;
  }
}

function setSessionNumber(key: string, value: number): void {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function cacheBustedHref(now: number): string {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(RELOAD_PARAM, String(now));
    return url.toString();
  } catch {
    return window.location.href;
  }
}

export function stripHardReloadParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RELOAD_PARAM)) return;
    url.searchParams.delete(RELOAD_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* ignore */
  }
}

export function hardReloadWithCacheBust({ key, cooldownMs }: HardReloadOptions): boolean {
  const now = Date.now();
  const lastReload = getSessionNumber(key);
  if (now - lastReload < cooldownMs) return false;

  setSessionNumber(key, now);
  window.location.replace(cacheBustedHref(now));
  return true;
}
