// PATH: src/app_admin/domains/auth/context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import api, { clearTokens, isSessionEnding, saveReturnPath } from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { setParentStudentId } from "@student/shared/api/parentStudentSelection";
import { setSentryUser, clearSentryUser } from "@/shared/lib/sentryContext";

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
  /** 초기 비밀번호 변경 강제 여부 */
  must_change_password?: boolean;
}

type AuthState = {
  user: User | null;
  isLoading: boolean;
  authUnavailable: boolean;
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

function getResponseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : undefined;
}

function shouldClearAuthForStatus(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 404;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const queryClient = useQueryClient();

  const clearAuth = useCallback(() => {
    clearTokens();
    clearSentryUser();
    setParentStudentId(null);  // in-memory 정리 (localStorage는 clearTokens가 처리)
    queryClient.clear();
    setUser(null);
    setAuthUnavailable(false);

    // 세션 만료 시 로그인 페이지로 이동 — axios interceptor가 이미 리다이렉트 중이면 스킵
    if (isSessionEnding) return;
    try {
      if (sessionStorage.getItem("session_expired") === "1") {
        sessionStorage.removeItem("session_expired");
        feedback.warn("세션이 만료되었습니다. 다시 로그인해 주세요.");
        saveReturnPath();
        window.location.href = "/login";
      }
    } catch { /* ignore */ }
  }, [queryClient]);

  const refreshMe = useCallback(async () => {
    const access = getAccessToken();
    if (!access) {
      setUser(null);
      setAuthUnavailable(false);
      return;
    }

    try {
      const res = await api.get<User>("/core/me/");
      const u = res.data ?? null;
      setUser(u);
      setAuthUnavailable(false);
      if (u) setSentryUser(u);
    } catch (err: unknown) {
      if (shouldClearAuthForStatus(getResponseStatus(err))) {
        clearAuth();
      } else {
        setAuthUnavailable(true);
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
          setAuthUnavailable(false);
          return;
        }

        const res = await api.get<User>("/core/me/");
        const u = res.data ?? null;
        setUser(u);
        setAuthUnavailable(false);
        if (u) setSentryUser(u);
      } catch (err: unknown) {
        if (shouldClearAuthForStatus(getResponseStatus(err))) {
          clearAuth();
        } else {
          setAuthUnavailable(true);
        }
        // 네트워크 오류(일시적 끊김)는 인증 상태 유지 — 로그아웃하지 않음
      } finally {
        setIsLoading(false);
      }
    })();
  }, [clearAuth]);

  // 다른 탭/창에서 로그아웃·401로 clearAuth() 시 이 탭도 로그인 상태 해제 → ProtectedRoute가 로그인으로 보냄
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "access" || e.key === "refresh") {
        if (e.newValue == null) {
          queryClient.clear();
          setParentStudentId(null);
          setUser(null);
          setAuthUnavailable(false);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  // 탭 포커스 시 인증 재검사 — 만료된 탭/다른 기기에서 열어둔 화면은 로그인으로 보냄
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const access = getAccessToken();
      if (!access) {
        // 이전에 로그인 상태였으면 세션 만료 → 로그인으로
        if (user) {
          setUser(null);
          setAuthUnavailable(false);
          feedback.warn("세션이 만료되었습니다. 다시 로그인해 주세요.");
          saveReturnPath();
          window.location.href = "/login";
        }
        return;
      }
      api.get<User>("/core/me/").then(
        (res) => {
          const newUser = res.data ?? null;
          setUser(newUser);
          setAuthUnavailable(false);
          if (newUser) setSentryUser(newUser);
        },
        (err: unknown) => {
          if (shouldClearAuthForStatus(getResponseStatus(err))) {
            clearAuth();
          } else {
            setAuthUnavailable(true);
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
      authUnavailable,
      refreshMe,
      clearAuth,
    }),
    [user, isLoading, authUnavailable, refreshMe, clearAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 기존 public import 경로를 유지한다. 대규모 학생 화면 style 부채와 분리해 처리하기 위한 예외.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
