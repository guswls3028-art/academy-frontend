// ====================================================================================================
// PATH: src/features/auth/context/AuthContext.tsx
// ====================================================================================================
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/shared/api/axios";
import {
  resolveTenantCode,
  setTenantCodeToStorage,
  clearTenantCodeFromStorage,
  TenantResolveResult,
} from "@/shared/tenant";

export interface User {
  id: number;
  username: string;
  email?: string;
  is_staff: boolean;
  is_superuser?: boolean;

  // ✅ 멀티테넌트 역할 (ProtectedRoute에서 사용)
  tenantRole?: "owner" | "admin" | "teacher" | "staff" | "student" | "parent";
}

type TenantState =
  | { status: "resolved"; code: string; source: TenantResolveResult extends { ok: true } ? any : any }
  | { status: "required" }  // tenant 미확정: UI가 tenant 선택/설정 필요
  | { status: "ambiguous" } // hostname/env로 결정 못함
  | { status: "invalid" };  // (확장 포인트)

type AuthState = {
  user: User | null;
  isLoading: boolean;

  tenant: TenantState;
  setTenant: (code: string) => void;
  clearTenant: () => void;

  refreshMe: () => Promise<void>;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function getAccess(): string | null {
  try {
    return localStorage.getItem("access");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenantState] = useState<TenantState>({ status: "required" });
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  const setTenant = (code: string) => {
    const v = (code || "").trim();
    if (!v) return;
    setTenantCodeToStorage(v);
    setTenantState({ status: "resolved", code: v, source: "storage" });
  };

  const clearTenant = () => {
    clearTenantCodeFromStorage();
    setTenantState({ status: "required" });
  };

  const refreshMe = async () => {
    const access = getAccess();
    if (!access) {
      setUser(null);
      return;
    }

    // ✅ tenant가 없으면 /core/me 호출 자체를 금지 (백엔드 계약)
    if (tenant.status !== "resolved") {
      setUser(null);
      return;
    }

    try {
      const res = await api.get<User>("/core/me/");
      setUser(res.data);
    } catch (err: any) {
      const status = err?.response?.status;

      // 401: axios layer에서 refresh 시도 후에도 실패하면 여기로 옴
      // 403: tenant/membership/role 문제 → refresh로 해결 불가
      if (status === 401 || status === 403) {
        clearAuth();
        setUser(null);
      }
      throw err;
    }
  };

  /**
   * ✅ Enterprise Bootstrap
   * 1) Resolve tenant (storage/hostname/env)
   * 2) If tenant missing/ambiguous: stop (UI must handle)
   * 3) If access token exists: call /core/me once
   */
  useEffect(() => {
    (async () => {
      try {
        const r = resolveTenantCode();
        if (r.ok) {
          setTenantState({ status: "resolved", code: r.code, source: r.source });
        } else {
          // hostname/env로 확정 불가 → 운영에서는 tenant 선택 화면 필요
          if (r.reason === "ambiguous") setTenantState({ status: "ambiguous" });
          else setTenantState({ status: "required" });
        }

        const access = getAccess();
        if (!access) {
          setUser(null);
          return;
        }

        // tenant resolved인 경우에만 me 호출
        if (r.ok) {
          await api.get<User>("/core/me/").then((res) => setUser(res.data));
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      tenant,
      setTenant,
      clearTenant,
      refreshMe,
      clearAuth,
    }),
    [user, isLoading, tenant]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
