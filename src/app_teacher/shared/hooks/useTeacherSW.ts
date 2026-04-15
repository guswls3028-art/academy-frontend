/**
 * useTeacherSW — 선생님 앱 Service Worker 등록 + 업데이트 감지
 *
 * - /teacher 경로에서만 등록
 * - 새 SW 발견 시 자동 업데이트 (skipWaiting이 SW에서 처리)
 * - manifest link도 동적 주입 (/teacher 경로에서만)
 */
import { useEffect } from "react";

export function useTeacherSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // manifest 동적 주입
    injectManifestLink();

    // theme-color 메타 태그 주입
    injectThemeColor();

    // apple-mobile-web-app 메타 태그 주입 (iOS PWA 지원)
    injectAppleMeta();

    // SW 등록
    navigator.serviceWorker
      .register("/teacher-sw.js", { scope: "/teacher" })
      .then((registration) => {
        // 업데이트 발견 시
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              // 새 SW 활성화됨 — VersionChecker가 이미 reload 처리하므로
              // 여기서는 추가 reload 하지 않음
              console.log("[TeacherSW] 새 버전 활성화됨");
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[TeacherSW] 등록 실패:", err);
      });

    return () => {
      // cleanup: manifest link 제거 (다른 앱으로 이동 시)
      removeManifestLink();
      removeThemeColor();
    };
  }, []);
}

function injectManifestLink() {
  if (document.querySelector('link[rel="manifest"][data-teacher]')) return;
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/teacher-manifest.json";
  link.setAttribute("data-teacher", "true");
  document.head.appendChild(link);
}

function removeManifestLink() {
  const link = document.querySelector('link[rel="manifest"][data-teacher]');
  if (link) link.remove();
}

function injectThemeColor() {
  if (document.querySelector('meta[name="theme-color"][data-teacher]')) return;
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = "#3b82f6";
  meta.setAttribute("data-teacher", "true");
  document.head.appendChild(meta);
}

function removeThemeColor() {
  const el = document.querySelector('meta[name="theme-color"][data-teacher]');
  if (el) el.remove();
}

function injectAppleMeta() {
  // apple-mobile-web-app-capable
  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const capable = document.createElement("meta");
    capable.name = "apple-mobile-web-app-capable";
    capable.content = "yes";
    capable.setAttribute("data-teacher", "true");
    document.head.appendChild(capable);
  }
  // apple-mobile-web-app-status-bar-style
  if (
    !document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  ) {
    const statusBar = document.createElement("meta");
    statusBar.name = "apple-mobile-web-app-status-bar-style";
    statusBar.content = "default";
    statusBar.setAttribute("data-teacher", "true");
    document.head.appendChild(statusBar);
  }
  // apple-touch-icon
  if (!document.querySelector('link[rel="apple-touch-icon"][data-teacher]')) {
    const icon = document.createElement("link");
    icon.rel = "apple-touch-icon";
    icon.href = "/teacher-icons/icon-192.svg";
    icon.setAttribute("data-teacher", "true");
    document.head.appendChild(icon);
  }
}
