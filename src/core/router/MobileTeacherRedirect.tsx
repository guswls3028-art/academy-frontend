/**
 * MobileTeacherRedirect — 모바일 디바이스 + staff 역할 → /teacher 자동 리다이렉트
 *
 * /admin 라우트 진입 시 감싸는 가드 컴포넌트.
 * - 모바일(≤1023px) + owner/admin/teacher/staff → /teacher로 리다이렉트
 * - localStorage "teacher:preferAdmin" = "1" 이면 리다이렉트 건너뜀 (수동 전환)
 * - PWA standalone 모드에서는 리다이렉트 하지 않음 (이미 teacher 앱 또는 의도적 admin 접근)
 */
import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { resolveTenantCodeString } from "@/shared/tenant";

const MOBILE_QUERY = "(max-width: 1023px)";

const STAFF_ROLES = ["owner", "admin", "teacher", "staff"];

function getPreferAdminKey(): string {
  return `teacher:preferAdmin:${resolveTenantCodeString()}`;
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function prefersAdmin(): boolean {
  try {
    return localStorage.getItem(getPreferAdminKey()) === "1";
  } catch {
    return false;
  }
}

export default function MobileTeacherRedirect() {
  const { user } = useAuth();
  const location = useLocation();

  // 조건: 모바일 + staff역할 + standalone 아닌 + 사용자가 admin 선호 아닌
  if (
    isMobileViewport() &&
    !isStandaloneMode() &&
    !prefersAdmin() &&
    user?.tenantRole &&
    STAFF_ROLES.includes(user.tenantRole)
  ) {
    // /admin/xxx → /teacher 홈으로 (admin의 세부 경로를 teacher에 매핑하지 않음)
    return <Navigate to="/teacher" replace />;
  }

  return <Outlet />;
}

/** admin 앱에서 "PC 버전 유지" 토글 시 호출 */
export function setPreferAdmin(prefer: boolean): void {
  try {
    const key = getPreferAdminKey();
    if (prefer) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage 접근 불가 무시
  }
}
