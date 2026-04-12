import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTenantBranding,
  uploadTenantLogo,
  patchTenantBranding,
  type TenantBrandingDto,
} from "@dev/domains/tenants/api/branding.api";

const KEYS = {
  branding: (id: number) => ["dev", "branding", id] as const,
};

export function useTenantBranding(id: number | null) {
  return useQuery({
    queryKey: KEYS.branding(id!),
    queryFn: () => getTenantBranding(id!),
    enabled: id != null && !isNaN(id),
    staleTime: 30_000,
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, file }: { tenantId: number; file: File }) =>
      uploadTenantLogo(tenantId, file),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.branding(vars.tenantId) });
    },
  });
}

export function usePatchBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, ...payload }: { tenantId: number } & Partial<TenantBrandingDto>) =>
      patchTenantBranding(tenantId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.branding(vars.tenantId) });
    },
  });
}
