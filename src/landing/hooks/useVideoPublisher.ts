import { useQuery } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import { resolveTenantCode } from "@/shared/tenant";
import { publicVideoQueryKeys } from "@/shared/api/queryKeys/publicVideos";
import { videoCapability } from "../api/publicVideos";

export function useVideoPublisher() {
  const { user, isAuthenticated, isLoading, authUnavailable, refreshMe } = useAuth();
  const tenant = resolveTenantCode();
  const capability = useQuery({
    queryKey: publicVideoQueryKeys.publisher(tenant.ok ? tenant.code : null, user?.id),
    queryFn: videoCapability,
    enabled: tenant.ok && isAuthenticated && !isLoading && !authUnavailable,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const state = isLoading ? "loading" : authUnavailable ? "error" : !tenant.ok || !isAuthenticated ? "denied" : capability.isError ? "error" : capability.isPending ? "loading" : capability.data ? "allowed" : "denied";
  return { state, retry: () => { void (authUnavailable ? refreshMe() : capability.refetch()).catch(() => undefined); } };
}
