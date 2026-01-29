// src/features/auth/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/shared/api/axios";

export interface User {
  id: number;
  username: string;
  email?: string;
  is_staff: boolean;
  is_superuser?: boolean;
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
    if (!access) {
      setUser(null);
      return;
    }

    try {
      const res = await api.get<User>("/core/me/");
      setUser(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      // ✅ 토큰 불량일 때만 로그아웃
      if (status === 401 || status === 403) {
        clearAuth();
      } else {
        // 네트워크 일시 오류면 user 유지 (null/기존값)
        // 여기서는 강제로 null로 만들지 않음
      }
      throw err;
    }
  };

  // ✅ 앱 시작 시 딱 1번만 호출
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
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
