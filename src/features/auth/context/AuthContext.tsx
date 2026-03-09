// PATH: src/features/auth/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "@/shared/api/axios";

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

  const clearAuth = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  const refreshMe = async () => {
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
      throw err;
    }
  };

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
        } else {
          setUser(null);
        }
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
        setUser(null);
        return;
      }
      api.get<User>("/core/me/").then(
        (res) => setUser(res.data ?? null),
        (err: any) => {
          const status = err?.response?.status;
          if (status === 401 || status === 403 || status === 404) {
            clearAuth();
          }
        }
      );
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      refreshMe,
      clearAuth,
    }),
    [user, isLoading]
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
