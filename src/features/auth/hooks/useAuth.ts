// PATH: src/features/auth/hooks/useAuth.ts
import { useAuthContext } from "@/features/auth/context/AuthContext";

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
