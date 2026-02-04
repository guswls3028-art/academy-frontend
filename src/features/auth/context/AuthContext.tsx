// ====================================================================================================
// PATH: src/features/auth/context/AuthContext.tsx
// ====================================================================================================
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "@/shared/api/axios";

export interface User {
  id: number;
  username: string;
  email?: string;
  is_staff: boolean;
  is_superuser?: boolean;

  // ✅ 멀티테넌트 역할 (ProtectedRoute에서 사용)
  tenantRole?: "owner" | "admin" | "teacher" | "staff" | "student" | "parent";
}

type AuthState = {
  user: User | null;
  isLoading: boolean;
  refreshMe: () => Promise<void>;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  const refreshMe = async () => {
    const access = localStorage.getItem("access");

    // ✅ access 토큰만 체크 (tenant는 interceptor에서 처리)
    if (!access) {
      setUser(null);
      return;
    }

    try {
      const res = await api.get<User>("/core/me/");
      setUser(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        clearAuth();
      }
      throw err;
    }
  };

  // ✅ 앱 시작 시 1회 실행
  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
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
