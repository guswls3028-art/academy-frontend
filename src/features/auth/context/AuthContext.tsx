// PATH: src/features/auth/context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";

export type TenantRole =
  | "owner"
  | "admin"
  | "teacher"
  | "staff"
  | "student"
  | "parent";

export interface User {
  id: number;
  username: string;

  name: string | null;
  phone: string | null;

  is_staff: boolean;
  is_superuser: boolean;

  tenantRole: TenantRole | null;
  /** 학부모일 때 연결된 학생 ID (첫 번째) */
  linkedStudentId?: number | null;
  /** 학부모일 때 연결된 학생 이름. 표시용 "{name} 학생 학부모님" */
  linkedStudentName?: string | null;
  /** 학부모일 때 연결된 자녀 목록 (삭제되지 않은 학생만) */
  linkedStudents?: { id: number; name: string }[] | null;
}

type AuthState = {
  user: User | null;
  isLoading: boolean;
  refreshMe: () => Promise<void>;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function getAccessToken(): string | null {
  try {
    return localStorage.getItem("access");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);

    // 세션 만료 플래그가 있으면 안내 메시지 표시 후 루트로 이동 (RootRedirect가 적절한 곳으로 보냄)
    try {
      if (sessionStorage.getItem("session_expired") === "1") {
        sessionStorage.removeItem("session_expired");
        feedback.warn("액세스 토큰이 만료되었습니다. 다시 로그인 해주세요.");
        window.location.href = "/";
      }
    } catch { /* ignore */ }
  }, []);

  const refreshMe = useCallback(async () => {
    const access = getAccessToken();
    if (!access) {
      setUser(null);
      return;
    }

    try {
      const res = await api.get<User>("/core/me/");
      setUser(res.data ?? null);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        clearAuth();
      }
      // 네트워크 오류(일시적 끊김 등)는 인증 상태를 유지 — axios 인터셉터의 refresh 메커니즘에 위임
      throw err;
    }
  }, [clearAuth]);

  useEffect(() => {
    (async () => {
      try {
        const access = getAccessToken();
        if (!access) {
          setUser(null);
          return;
        }

        const res = await api.get<User>("/core/me/");
        setUser(res.data ?? null);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          clearAuth();
        }
        // 네트워크 오류(일시적 끊김)는 인증 상태 유지 — 로그아웃하지 않음
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 다른 탭/창에서 로그아웃·401로 clearAuth() 시 이 탭도 로그인 상태 해제 → ProtectedRoute가 로그인으로 보냄
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "access" || e.key === "refresh") {
        if (e.newValue == null) setUser(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 탭 포커스 시 인증 재검사 — 만료된 탭/다른 기기에서 열어둔 화면은 로그인으로 보냄
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const access = getAccessToken();
      if (!access) {
        // 이전에 로그인 상태였으면 세션 만료 안내
        if (user) {
          setUser(null);
          feedback.warn("액세스 토큰이 만료되었습니다. 다시 로그인 해주세요.");
          window.location.href = "/";
        }
        return;
      }
      api.get<User>("/core/me/").then(
        (res) => setUser(res.data ?? null),
        (err: any) => {
          const status = err?.response?.status;
          if (status === 401 || status === 403 || status === 404) {
            clearAuth();
          }
          // 네트워크 오류는 인증 상태 유지
        }
      );
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user, clearAuth]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      refreshMe,
      clearAuth,
    }),
    [user, isLoading, refreshMe, clearAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
