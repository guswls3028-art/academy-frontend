/* eslint-disable no-restricted-syntax */
// PATH: src/app/router/ProtectedRoute.tsx
import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";
import ForcePasswordChangeModal from "@/auth/components/ForcePasswordChangeModal";
import AuthUnavailableState from "@/auth/components/AuthUnavailableState";

export type Role =
  | "owner"
  | "admin"
  | "teacher"
  | "staff"
  | "student"
  | "parent";

const ADMIN_ROLES: Role[] = ["owner", "admin", "teacher", "staff"];
const STUDENT_ROLES: Role[] = ["student", "parent"];

export default function ProtectedRoute({ allow, tenantOnly }: { allow: Role[]; tenantOnly?: string[] }) {
  const { user, isLoading, authUnavailable, refreshMe } = useAuth();
  const { program, isLoading: programLoading, error: programError, refetch: refetchProgram } = useProgram();
  const [retrying, setRetrying] = useState(false);

  if (programLoading || isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--color-text-muted, #888)", fontSize: "var(--text-sm, 13px)" }}>
        불러오는 중…
      </div>
    );
  }

  // 일시적 program 미식별 — full-page redirect 대신 inline 카드. 학원장이 컨텍스트 유지.
  if (!program) {
    const onRetry = async () => {
      setRetrying(true);
      try { await refetchProgram(); } finally { setRetrying(false); }
    };
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div style={{ maxWidth: 380, padding: 28, borderRadius: 14, background: "var(--color-surface, #fff)", border: "1px solid var(--color-border, #E5E7EB)", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }} aria-hidden>⚠️</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary, #111827)", margin: "0 0 8px" }}>
            잠깐, 학원 정보를 다시 확인 중입니다
          </p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary, #6B7280)", margin: "0 0 16px", lineHeight: 1.55 }}>
            {programError
              ? "일시적인 연결 문제일 수 있어요. 다시 시도해 주세요."
              : "잠시 후 자동으로 복구됩니다."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            style={{
              padding: "9px 22px", borderRadius: 8, border: "none",
              background: retrying ? "#94a3b8" : "#2563eb",
              color: "#fff", fontWeight: 600, fontSize: 13.5,
              cursor: retrying ? "not-allowed" : "pointer",
            }}
          >
            {retrying ? "연결 중…" : "다시 시도"}
          </button>
        </div>
      </div>
    );
  }

  if (authUnavailable && !user) {
    return <AuthUnavailableState retry={refreshMe} />;
  }

  const loginRedirect = <Navigate to="/login" replace />;

  if (!user) {
    return loginRedirect;
  }

  const role: Role | undefined = user.tenantRole ?? undefined;

  if (!role) {
    return loginRedirect;
  }

  // tenantOnly: 특정 테넌트만 허용 (e.g., dev 페이지)
  if (tenantOnly && tenantOnly.length > 0) {
    const tc = program?.tenantCode;
    if (!tc || !tenantOnly.includes(tc)) {
      if (ADMIN_ROLES.includes(role)) {
        return <Navigate to="/admin" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  if (!allow.includes(role)) {
    if (ADMIN_ROLES.includes(role)) {
      return <Navigate to="/admin" replace />;
    }

    if (STUDENT_ROLES.includes(role)) {
      return <Navigate to="/student" replace />;
    }

    return loginRedirect;
  }

  if (user.must_change_password) {
    return <ForcePasswordChangeModal onSuccess={() => refreshMe()} />;
  }

  return <Outlet />;
}
