/* eslint-disable react-refresh/only-export-components */
/**
 * 통합 업무는 기기 폭과 관계없이 같은 화면·권한·기능을 사용한다.
 *
 * 기존 간편 업무 링크와 명시적인 전환의 복귀 정보는 호환 유지한다.
 * 화면 폭만으로 현재 경로나 편집 중인 화면을 교체하지 않는다.
 */
import { Outlet } from "react-router";
import { resolveTenantCode, resolveTenantCodeString } from "@/shared/tenant";
import { WORKSPACE_PATHS, parseMobileWorkspaceReturnPath } from "./workspaceRoutes";
import { getLocalItem, removeLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";
import { getSessionItem, removeSessionItem, setSessionItem } from "@/shared/utils/safeSessionStorage";

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

function getPreferenceKey(): string {
  return `workspace:preferFull:${resolveTenantCodeString()}`;
}

function getLegacyPreferenceKey(): string {
  return `teacher:preferAdmin:${resolveTenantCodeString()}`;
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
