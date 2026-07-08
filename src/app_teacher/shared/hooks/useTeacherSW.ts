/**
 * useTeacherSW — 선생님 앱 Service Worker 등록 + 업데이트 감지
 *
 * - /teacher 경로에서만 등록
 * - 새 SW 발견 시 자동 업데이트 (skipWaiting이 SW에서 처리)
 * - manifest link도 동적 주입 (/teacher 경로에서만)
 */
import { useEffect } from "react";
import { getTenantDefByHostname } from "@/shared/tenant/tenants";

const TEACHER_MANIFEST_HREF = "/teacher-manifest.json";
const DEFAULT_TEACHER_APP_TITLE = "학원플러스 선생님";
const DEFAULT_TEACHER_APP_ICON = "/teacher-icons/icon-192.svg";
const TEACHER_THEME_COLOR = "#3b82f6";
const DATA_TEACHER = "data-teacher";
const DATA_TEACHER_CREATED = "data-teacher-created";
const DATA_PREVIOUS_HREF = "data-teacher-previous-href";
const DATA_PREVIOUS_CONTENT = "data-teacher-previous-content";

const TEACHER_APP_ICON_BY_HOST: Record<string, string> = {
  "tchul.com": "/tenants/tchul/icon.png",
  "www.tchul.com": "/tenants/tchul/icon.png",
  "ymath.co.kr": "/tenants/ymath/icon.png",
  "www.ymath.co.kr": "/tenants/ymath/icon.png",
  "limglish.kr": "/tenants/limglish/icon.png",
  "www.limglish.kr": "/tenants/limglish/icon.png",
  "hakwonplus.com": DEFAULT_TEACHER_APP_ICON,
  "www.hakwonplus.com": DEFAULT_TEACHER_APP_ICON,
  "sswe.co.kr": "/tenants/sswe/icon.png",
  "www.sswe.co.kr": "/tenants/sswe/icon.png",
  "dnbacademy.co.kr": "/tenants/dnb/logo.png",
  "www.dnbacademy.co.kr": "/tenants/dnb/logo.png",
};

type TeacherInstallMeta = {
  title: string;
  iconHref: string;
};

export function useTeacherSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const installMeta = getTeacherInstallMeta();

    // manifest 동적 주입
    injectManifestLink();

    // theme-color 메타 태그 주입
    injectThemeColor();

    // apple-mobile-web-app 메타 태그 주입 (iOS PWA 지원)
    injectAppleMeta(installMeta);

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
              // 여기서는 추가 reload 하지 않음.
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
      removeAppleMeta();
    };
  }, []);
}

function getTeacherInstallMeta(): TeacherInstallMeta {
  const hostname = window.location.hostname.toLowerCase();
  const tenant = getTenantDefByHostname(hostname);
  const brandTitle =
    tenant?.branding.windowTitle ||
    tenant?.branding.loginTitle ||
    tenant?.name ||
    "학원플러스";
  const iconHref =
    TEACHER_APP_ICON_BY_HOST[hostname] ||
    tenant?.branding.headerLogoUrl ||
    tenant?.branding.faviconUrl ||
    tenant?.branding.logoUrl ||
    DEFAULT_TEACHER_APP_ICON;

  return {
    title: `${brandTitle} 선생님`,
    iconHref,
  };
}

function injectManifestLink() {
  let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    link.setAttribute(DATA_TEACHER_CREATED, "true");
    document.head.appendChild(link);
  } else if (!link.hasAttribute(DATA_PREVIOUS_HREF)) {
    link.setAttribute(DATA_PREVIOUS_HREF, link.getAttribute("href") || "");
  }

  link.href = TEACHER_MANIFEST_HREF;
  link.setAttribute(DATA_TEACHER, "true");
}

function removeManifestLink() {
  const link = document.querySelector('link[rel="manifest"][data-teacher]');
  if (!link) return;
  if (link.getAttribute(DATA_TEACHER_CREATED) === "true") {
    link.remove();
    return;
  }

  const previousHref = link.getAttribute(DATA_PREVIOUS_HREF);
  if (previousHref != null) {
    if (previousHref) link.setAttribute("href", previousHref);
    else link.removeAttribute("href");
  }
  link.removeAttribute(DATA_TEACHER);
  link.removeAttribute(DATA_TEACHER_CREATED);
  link.removeAttribute(DATA_PREVIOUS_HREF);
}

function injectThemeColor() {
  upsertManagedMeta("theme-color", TEACHER_THEME_COLOR);
}

function removeThemeColor() {
  restoreManagedMeta("theme-color");
}

function removeAppleMeta() {
  restoreManagedMeta("apple-mobile-web-app-capable");
  restoreManagedMeta("apple-mobile-web-app-status-bar-style");
  restoreManagedMeta("apple-mobile-web-app-title");
  restoreManagedLink('link[rel="apple-touch-icon"][data-teacher]');
}

function injectAppleMeta(installMeta: TeacherInstallMeta) {
  // apple-mobile-web-app-capable
  upsertManagedMeta("apple-mobile-web-app-capable", "yes");
  // apple-mobile-web-app-status-bar-style
  upsertManagedMeta("apple-mobile-web-app-status-bar-style", "default");
  // apple-mobile-web-app-title
  upsertManagedMeta(
    "apple-mobile-web-app-title",
    installMeta.title || DEFAULT_TEACHER_APP_TITLE
  );
  // apple-touch-icon
  upsertManagedLink("apple-touch-icon", installMeta.iconHref || DEFAULT_TEACHER_APP_ICON);
}

function upsertManagedMeta(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    meta.setAttribute(DATA_TEACHER_CREATED, "true");
    document.head.appendChild(meta);
  } else if (!meta.hasAttribute(DATA_PREVIOUS_CONTENT)) {
    meta.setAttribute(DATA_PREVIOUS_CONTENT, meta.getAttribute("content") || "");
  }

  meta.content = content;
  meta.setAttribute(DATA_TEACHER, "true");
}

function restoreManagedMeta(name: string) {
  const meta = document.querySelector(`meta[name="${name}"][data-teacher]`) as HTMLMetaElement | null;
  if (!meta) return;
  if (meta.getAttribute(DATA_TEACHER_CREATED) === "true") {
    meta.remove();
    return;
  }

  const previousContent = meta.getAttribute(DATA_PREVIOUS_CONTENT);
  if (previousContent != null) {
    meta.content = previousContent;
  }
  meta.removeAttribute(DATA_TEACHER);
  meta.removeAttribute(DATA_TEACHER_CREATED);
  meta.removeAttribute(DATA_PREVIOUS_CONTENT);
}

function upsertManagedLink(rel: string, href: string) {
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    link.setAttribute(DATA_TEACHER_CREATED, "true");
    document.head.appendChild(link);
  } else if (!link.hasAttribute(DATA_PREVIOUS_HREF)) {
    link.setAttribute(DATA_PREVIOUS_HREF, link.getAttribute("href") || "");
  }

  link.href = href;
  link.setAttribute(DATA_TEACHER, "true");
}

function restoreManagedLink(selector: string) {
  const link = document.querySelector(selector) as HTMLLinkElement | null;
  if (!link) return;
  if (link.getAttribute(DATA_TEACHER_CREATED) === "true") {
    link.remove();
    return;
  }

  const previousHref = link.getAttribute(DATA_PREVIOUS_HREF);
  if (previousHref != null) {
    if (previousHref) link.setAttribute("href", previousHref);
    else link.removeAttribute("href");
  }
  link.removeAttribute(DATA_TEACHER);
  link.removeAttribute(DATA_TEACHER_CREATED);
  link.removeAttribute(DATA_PREVIOUS_HREF);
}
