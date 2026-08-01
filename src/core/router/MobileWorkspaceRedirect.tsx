/* eslint-disable react-refresh/only-export-components */
/**
 * MobileWorkspaceRedirect — 모바일 브라우저의 통합 업무 홈을 모바일 업무 홈으로 전환
 *
 * - 모바일(≤1023px) + 교직원 역할의 통합 업무 홈 진입 → 모바일 업무 홈
 * - 성적/시험/차시/메시지 등 명시적인 통합 업무 딥링크는 모바일에서도 유지
 * - 사용자가 통합 업무 화면을 선택하면 테넌트별로 선호를 기억
 * - PWA standalone 모드에서는 이미 선택한 화면을 유지
 */
import { Navigate, Outlet, useLocation } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { resolveTenantCodeString } from "@/shared/tenant";
import { WORKSPACE_PATHS } from "./workspaceRoutes";

const MOBILE_QUERY = "(max-width: 1023px)";

const WORKSPACE_ROLES = ["owner", "admin", "teacher", "staff"];

function shouldRedirectFullWorkspaceHome(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === WORKSPACE_PATHS.full
    || normalized === `${WORKSPACE_PATHS.full}/dashboard`
  );
}

function getPreferenceKey(): string {
  return `workspace:preferFull:${resolveTenantCodeString()}`;
}

function getLegacyPreferenceKey(): string {
  return `teacher:preferAdmin:${resolveTenantCodeString()}`;
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export function prefersFullWorkspace(): boolean {
  try {
    if (localStorage.getItem(getPreferenceKey()) === "1") return true;
    if (localStorage.getItem(getLegacyPreferenceKey()) !== "1") return false;

    localStorage.setItem(getPreferenceKey(), "1");
    localStorage.removeItem(getLegacyPreferenceKey());
    return true;
  } catch {
    return false;
  }
}

export default function MobileWorkspaceRedirect() {
  const { user } = useAuth();
  const location = useLocation();

  if (
    isMobileViewport() &&
    !isStandaloneMode() &&
    !prefersFullWorkspace() &&
    user?.tenantRole &&
    shouldRedirectFullWorkspaceHome(location.pathname) &&
    WORKSPACE_ROLES.includes(user.tenantRole)
  ) {
    return <Navigate to={WORKSPACE_PATHS.mobile} replace />;
  }

  return <Outlet />;
}

export function setPreferFullWorkspace(prefer: boolean): void {
  try {
    if (prefer) {
      localStorage.setItem(getPreferenceKey(), "1");
    } else {
      localStorage.removeItem(getPreferenceKey());
    }
    localStorage.removeItem(getLegacyPreferenceKey());
  } catch {
    // localStorage 접근 불가 무시
  }
}
