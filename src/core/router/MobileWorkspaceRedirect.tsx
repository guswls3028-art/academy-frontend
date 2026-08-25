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
import { resolveTenantCode, resolveTenantCodeString } from "@/shared/tenant";
import { WORKSPACE_PATHS, parseMobileWorkspaceReturnPath } from "./workspaceRoutes";
import { getLocalItem, removeLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";
import { getSessionItem, removeSessionItem, setSessionItem } from "@/shared/utils/safeSessionStorage";

const MOBILE_QUERY = "(max-width: 1023px)";

const WORKSPACE_ROLES = ["owner", "admin", "teacher", "staff"];
const MOBILE_RETURN_KEY_PREFIX = "workspace:mobileReturn:v1";
const MOBILE_RETURN_MAX_AGE_MS = 8 * 60 * 60 * 1000;

type FullWorkspacePreferenceContext = {
  accountId?: number | null;
  mobileReturnPath?: string | null;
};

function positiveAccountId(accountId: number | null | undefined): number | null {
  return Number.isSafeInteger(accountId) && Number(accountId) > 0 ? Number(accountId) : null;
}

function getMobileReturnKey(accountId: number | null | undefined): string | null {
  const validAccountId = positiveAccountId(accountId);
  const tenant = resolveTenantCode();
  if (!validAccountId || !tenant.ok) return null;
  return `${MOBILE_RETURN_KEY_PREFIX}:${encodeURIComponent(tenant.code)}:${validAccountId}`;
}

function rememberMobileWorkspaceReturnPath(context: FullWorkspacePreferenceContext | undefined): void {
  const key = getMobileReturnKey(context?.accountId);
  if (!key) return;
  const path = context?.mobileReturnPath
    ? parseMobileWorkspaceReturnPath(context.mobileReturnPath)
    : null;
  if (!path) {
    removeSessionItem(key);
    return;
  }
  setSessionItem(key, JSON.stringify({ path, savedAt: Date.now() }));
}

export function consumeMobileWorkspaceReturnPath(accountId: number | null | undefined): string {
  const key = getMobileReturnKey(accountId);
  if (!key) return WORKSPACE_PATHS.mobile;
  const raw = getSessionItem(key);
  removeSessionItem(key);
  if (!raw) return WORKSPACE_PATHS.mobile;

  try {
    const parsed = JSON.parse(raw) as { path?: unknown; savedAt?: unknown };
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : NaN;
    const age = Date.now() - savedAt;
    if (!Number.isFinite(savedAt) || age < 0 || age > MOBILE_RETURN_MAX_AGE_MS) {
      return WORKSPACE_PATHS.mobile;
    }
    return typeof parsed.path === "string"
      ? parseMobileWorkspaceReturnPath(parsed.path) ?? WORKSPACE_PATHS.mobile
      : WORKSPACE_PATHS.mobile;
  } catch {
    return WORKSPACE_PATHS.mobile;
  }
}

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
    if (getLocalItem(getPreferenceKey()) === "1") return true;
    if (getLocalItem(getLegacyPreferenceKey()) !== "1") return false;

    setLocalItem(getPreferenceKey(), "1");
    removeLocalItem(getLegacyPreferenceKey());
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

export function setPreferFullWorkspace(
  prefer: boolean,
  context?: FullWorkspacePreferenceContext,
): void {
  try {
    if (prefer) {
      setLocalItem(getPreferenceKey(), "1");
      rememberMobileWorkspaceReturnPath(context);
    } else {
      removeLocalItem(getPreferenceKey());
    }
    removeLocalItem(getLegacyPreferenceKey());
  } catch {
    // localStorage 접근 불가 무시
  }
}
