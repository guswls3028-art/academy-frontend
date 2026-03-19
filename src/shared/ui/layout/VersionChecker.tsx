/**
 * VersionChecker — 배포 후 자동 업데이트
 *
 * 주의: 이 모듈은 React 컴포넌트가 아닌 hook으로 사용해야 함.
 * Vite/Rollup이 null 반환 컴포넌트를 tree-shake할 수 있으므로
 * useVersionChecker() hook을 App.tsx에서 직접 호출한다.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { feedback } from "@/shared/ui/feedback/feedback";

declare const __BUILD_TIMESTAMP__: string;

const CHECK_INTERVAL = 5 * 60 * 1000;
const RESUME_DEBOUNCE = 2_000;

const CURRENT_VERSION: string | undefined =
  typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : undefined;

let pendingUpdate = false;
let blockCount = 0;

export function blockAutoReload(): () => void {
  blockCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    blockCount = Math.max(0, blockCount - 1);
    if (blockCount === 0 && pendingUpdate) {
      window.location.reload();
    }
  };
}

export function unblockAutoReload(): void {
  blockCount = Math.max(0, blockCount - 1);
  if (blockCount === 0 && pendingUpdate) {
    window.location.reload();
  }
}

function isBlocked(): boolean {
  return blockCount > 0;
}

function reloadOrNotify(): void {
  if (isBlocked()) {
    feedback.info("새 버전이 준비되었습니다. 작업 완료 후 자동 업데이트됩니다.");
    return;
  }
  window.location.reload();
}

async function checkVersion(): Promise<boolean> {
  if (!CURRENT_VERSION) return false;
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return false;
    const data = await res.json();
    if (data.version && data.version !== CURRENT_VERSION) {
      pendingUpdate = true;
      return true;
    }
  } catch {
    // 네트워크 에러 무시
  }
  return false;
}

/**
 * App.tsx에서 호출하는 hook.
 * 컴포넌트가 아닌 hook이므로 tree-shaking 대상이 아님.
 */
export function useVersionChecker(): void {
  const location = useLocation();
  const initialPath = useRef(location.pathname);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. 정기 폴링
  useEffect(() => {
    if (!CURRENT_VERSION) return;
    const firstTimeout = setTimeout(checkVersion, 60_000);
    const interval = setInterval(checkVersion, CHECK_INTERVAL);
    return () => {
      clearTimeout(firstTimeout);
      clearInterval(interval);
    };
  }, []);

  // 2. 라우트 전환 시
  useEffect(() => {
    if (location.pathname === initialPath.current) return;
    if (pendingUpdate) reloadOrNotify();
  }, [location.pathname]);

  // 3. visibilitychange + pageshow 복귀
  useEffect(() => {
    if (!CURRENT_VERSION) return;

    const onResume = () => {
      if (pendingUpdate) {
        reloadOrNotify();
        return;
      }
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(async () => {
        const isNew = await checkVersion();
        if (isNew) reloadOrNotify();
      }, RESUME_DEBOUNCE);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onResume();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);
}

/** @deprecated 하위 호환용 — useVersionChecker() hook으로 대체 */
export default function VersionChecker(): null {
  useVersionChecker();
  return null;
}
