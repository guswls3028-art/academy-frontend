import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTenants,
  getTenant,
  createTenant,
  updateTenant,
  getTenantOwners,
  registerTenantOwner,
  updateTenantOwner,
  removeTenantOwner,
  type TenantDto,
  type CreateTenantDto,
} from "@/dev_app/api/tenants";

const KEYS = {
  list: ["dev", "tenants"] as const,
  detail: (id: number) => ["dev", "tenants", id] as const,
  owners: (id: number) => ["dev", "tenants", id, "owners"] as const,
};

export function useTenantList() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: getTenants,
    staleTime: 30_000,
  });
}

export function useTenantDetail(id: number | null) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    queryFn: () => getTenant(id!),
    enabled: id != null && !isNaN(id),
    staleTime: 30_000,
  });
}

export function useTenantOwners(id: number | null) {
  return useQuery({
    queryKey: KEYS.owners(id!),
    queryFn: () => getTenantOwners(id!),
    enabled: id != null && !isNaN(id),
    staleTime: 30_000,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTenantDto) => createTenant(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list }),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<Pick<TenantDto, "name" | "isActive">>) =>
      updateTenant(id, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) });
    },
  });
}

export function useRegisterOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, ...payload }: { tenantId: number; username: string; password?: string; name?: string; phone?: string }) =>
      registerTenantOwner(tenantId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.owners(vars.tenantId) });
    },
  });
}

export function useUpdateOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, userId, ...payload }: { tenantId: number; userId: number; name?: string; phone?: string }) =>
      updateTenantOwner(tenantId, userId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.owners(vars.tenantId) });
    },
  });
}

export function useRemoveOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, userId }: { tenantId: number; userId: number }) =>
      removeTenantOwner(tenantId, userId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.owners(vars.tenantId) });
    },
  });
}
