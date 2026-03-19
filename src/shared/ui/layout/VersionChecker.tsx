/**
 * VersionChecker — 배포 후 자동 업데이트
 *
 * 전략: 배너 대신 자동 리로드
 * 1. 5분마다 /version.json 폴링으로 새 버전 감지
 * 2. 새 버전 감지 시 플래그만 설정 (즉시 리로드 안함)
 * 3. 다음 라우트 전환 시 자동 리로드 (사용자가 이미 이동 중이므로 자연스러움)
 * 4. 탭 복귀 시 새 버전이면 자동 리로드
 * 5. blockAutoReload/unblockAutoReload — 폼 작성 중 리로드 방지
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { feedback } from "@/shared/ui/feedback/feedback";

declare const __BUILD_TIMESTAMP__: string;

const CHECK_INTERVAL = 5 * 60 * 1000; // 5분

/** 전역 플래그: 새 버전 감지됨 */
let pendingUpdate = false;

/** 자동 리로드 차단 카운터 (0이면 허용, >0이면 차단) */
let blockCount = 0;

/**
 * 폼 작성 등 작업 중 자동 리로드를 차단한다.
 * 반환값: unblock 함수 (cleanup용)
 *
 * @example
 * useEffect(() => {
 *   if (isDirty) return blockAutoReload();
 * }, [isDirty]);
 */
export function blockAutoReload(): () => void {
  blockCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    blockCount = Math.max(0, blockCount - 1);
    // 차단 해제 시 대기 중인 업데이트가 있으면 리로드
    if (blockCount === 0 && pendingUpdate) {
      window.location.reload();
    }
  };
}

/**
 * 명시적 차단 해제 (blockAutoReload의 반환값 대신 직접 호출 가능)
 */
export function unblockAutoReload(): void {
  blockCount = Math.max(0, blockCount - 1);
  if (blockCount === 0 && pendingUpdate) {
    window.location.reload();
  }
}

/** 리로드가 현재 차단되었는지 확인 */
function isBlocked(): boolean {
  return blockCount > 0;
}

/** 차단 중이면 토스트만 표시, 아니면 리로드 */
function reloadOrNotify(): void {
  if (isBlocked()) {
    feedback.info("새 버전이 준비되었습니다. 작업 완료 후 자동 업데이트됩니다.");
    return;
  }
  window.location.reload();
}

export default function VersionChecker() {
  const location = useLocation();
  const initialPath = useRef(location.pathname);

  // 1. 폴링: 새 버전 감지
  useEffect(() => {
    if (typeof __BUILD_TIMESTAMP__ === "undefined") return;
    const currentVersion = __BUILD_TIMESTAMP__;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== currentVersion) {
          pendingUpdate = true;
        }
      } catch {
        // 네트워크 에러 무시
      }
    };

    // 첫 체크는 1분 후 (앱 로드 직후가 아닌)
    const firstTimeout = setTimeout(check, 60_000);
    const interval = setInterval(check, CHECK_INTERVAL);
    return () => {
      clearTimeout(firstTimeout);
      clearInterval(interval);
    };
  }, []);

  // 2. 라우트 전환 시: 새 버전이면 자동 리로드 (차단 시 토스트)
  useEffect(() => {
    // 최초 마운트 시에는 리로드하지 않음
    if (location.pathname === initialPath.current) return;
    if (pendingUpdate) {
      reloadOrNotify();
    }
  }, [location.pathname]);

  // 3. 탭 복귀 시: 새 버전이면 자동 리로드 (차단 시 토스트)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && pendingUpdate) {
        reloadOrNotify();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // UI 없음 — 배너 제거
  return null;
}
