/**
 * VersionChecker — 배포 후 자동 업데이트
 *
 * 전략: 배너 대신 자동 리로드
 * 1. 5분마다 /version.json 폴링으로 새 버전 감지
 * 2. 새 버전 감지 시 플래그만 설정 (즉시 리로드 안함)
 * 3. 다음 라우트 전환 시 자동 리로드 (사용자가 이미 이동 중이므로 자연스러움)
 * 4. 탭 복귀 시 새 버전이면 자동 리로드
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

declare const __BUILD_TIMESTAMP__: string;

const CHECK_INTERVAL = 5 * 60 * 1000; // 5분

/** 전역 플래그: 새 버전 감지됨 */
let pendingUpdate = false;

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

  // 2. 라우트 전환 시: 새 버전이면 자동 리로드
  useEffect(() => {
    // 최초 마운트 시에는 리로드하지 않음
    if (location.pathname === initialPath.current) return;
    if (pendingUpdate) {
      window.location.reload();
    }
  }, [location.pathname]);

  // 3. 탭 복귀 시: 새 버전이면 자동 리로드
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && pendingUpdate) {
        window.location.reload();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // UI 없음 — 배너 제거
  return null;
}
