/**
 * VersionChecker — 배포 후 자동 업데이트
 *
 * 전략:
 * 1. 5분마다 /version.json 폴링으로 새 버전 감지
 * 2. visibilitychange / pageshow 복귀 시 즉시 version.json 재조회
 *    (카카오 인앱 브라우저, bfcache 복원 대응)
 * 3. 새 버전이면 안전하게 reload (blockAutoReload 연동)
 * 4. 라우트 전환 시에도 pending update 반영
 *
 * blockAutoReload/unblockAutoReload — 폼 작성 중 리로드 방지
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { feedback } from "@/shared/ui/feedback/feedback";

declare const __BUILD_TIMESTAMP__: string;

const CHECK_INTERVAL = 5 * 60 * 1000; // 5분
const RESUME_DEBOUNCE = 2_000; // 복귀 후 2초 대기 (네트워크 안정화)

/** 현재 빌드 버전 (dev에서는 undefined) */
const CURRENT_VERSION: string | undefined =
  typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : undefined;

/** 전역 플래그: 새 버전 감지됨 */
let pendingUpdate = false;

/** 자동 리로드 차단 카운터 */
let blockCount = 0;

/**
 * 폼 작성 등 작업 중 자동 리로드를 차단한다.
 * 반환값: unblock 함수 (cleanup용)
 */
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

/** version.json을 조회하고 새 버전이면 pendingUpdate 설정 */
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

export default function VersionChecker() {
  const location = useLocation();
  const initialPath = useRef(location.pathname);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. 정기 폴링 (5분)
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
    if (pendingUpdate) {
      reloadOrNotify();
    }
  }, [location.pathname]);

  // 3. visibilitychange + pageshow 복귀 시 즉시 조회
  //    카카오 인앱 브라우저, bfcache, 장시간 백그라운드 복귀 대응
  useEffect(() => {
    if (!CURRENT_VERSION) return;

    const onResume = () => {
      // 이미 감지됨 — 즉시 처리
      if (pendingUpdate) {
        reloadOrNotify();
        return;
      }

      // 새로 조회 (debounce: 빠른 연속 이벤트 방지)
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(async () => {
        const isNew = await checkVersion();
        if (isNew) {
          reloadOrNotify();
        }
      }, RESUME_DEBOUNCE);
    };

    // visibilitychange: 탭 전환, 앱 전환
    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
    };

    // pageshow: bfcache 복원 (카카오 인앱 브라우저, Safari 등)
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onResume(); // bfcache에서 복원된 경우만
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  return null;
}
