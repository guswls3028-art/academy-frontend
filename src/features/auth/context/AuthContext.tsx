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
