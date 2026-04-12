// PATH: src/app_admin/domains/auth/hooks/useAuth.ts
import { useAuthContext } from "@/auth/context/AuthContext";

export default function useAuth() {
  const { user, isLoading, refreshMe, clearAuth } = useAuthContext();

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    refreshMe,
    clearAuth,
  };
}
