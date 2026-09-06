/**
 * 새 배포를 감지하되 열린 영상·입력·업로드 화면은 자동으로 새로고침하지 않는다.
 * 실제 stale chunk 오류 복구는 ErrorBoundary가 별도로 제한해서 소유한다.
 */
import { useEffect, useState } from "react";

declare const __BUILD_TIMESTAMP__: string;

const CHECK_INTERVAL = 5 * 60 * 1000;
const RESUME_DEBOUNCE = 2_000;
const CURRENT_VERSION: string | undefined =
  typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : undefined;

function versionUrl(): string | null {
  if (typeof window === "undefined" || !window.location.origin.startsWith("http")) {
    return null;
  }
  const url = new URL("/version.json", window.location.origin);
  url.searchParams.set("_", String(Date.now()));
  return url.toString();
}

async function hasNewVersion(): Promise<boolean> {
  if (!CURRENT_VERSION) return false;
  const url = versionUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      mode: "same-origin",
    });
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("json")) return false;
    const data = await res.json();
    return Boolean(data.version && data.version !== CURRENT_VERSION);
  } catch {
    // A failed version check must not interrupt the current user flow.
    return false;
  }
}

export function useVersionChecker(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!CURRENT_VERSION || updateAvailable) return;

    let active = true;
    const detect = async () => {
      if (await hasNewVersion()) {
        if (active) setUpdateAvailable(true);
      }
    };
    const firstTimeout = window.setTimeout(() => void detect(), 5_000);
    const interval = window.setInterval(() => void detect(), CHECK_INTERVAL);
    return () => {
      active = false;
      window.clearTimeout(firstTimeout);
      window.clearInterval(interval);
    };
  }, [updateAvailable]);

  useEffect(() => {
    if (!CURRENT_VERSION || updateAvailable) return;

    let active = true;
    let resumeTimer: number | null = null;
    const onResume = () => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(async () => {
        if (await hasNewVersion()) {
          if (active) setUpdateAvailable(true);
        }
      }, RESUME_DEBOUNCE);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onResume();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      if (resumeTimer) window.clearTimeout(resumeTimer);
    };
  }, [updateAvailable]);

  return updateAvailable;
}
