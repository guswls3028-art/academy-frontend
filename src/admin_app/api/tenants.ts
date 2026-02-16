// PATH: src/admin_app/api/tenants.ts
// Tenant management API

import api from "@/shared/api/axios";

export type TenantDto = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  primaryDomain: string | null;
  domains: string[];
};

export type TenantDetailDto = TenantDto & {
  domains: Array<{ host: string; isPrimary: boolean }>;
  hasProgram: boolean;
};

export type CreateTenantDto = {
  code: string;
  name: string;
  domain?: string;
};

export type TenantOwnerDto = {
  tenantId?: number;
  tenantCode?: string;
  userId: number;
  username: string;
  name: string;
  role: string;
};

/** GET all tenants */
export async function getTenants(): Promise<TenantDto[]> {
  const res = await api.get<TenantDto[]>("/core/tenants/");
  return res.data;
}

/** GET tenant detail */
export async function getTenant(tenantId: number): Promise<TenantDetailDto> {
  const res = await api.get<TenantDetailDto>(`/core/tenants/${tenantId}/`);
  return res.data;
}

/** POST create tenant */
export async function createTenant(payload: CreateTenantDto): Promise<TenantDto> {
  const res = await api.post<TenantDto>("/core/tenants/create/", payload);
  return res.data;
}

/** PATCH update tenant */
export async function updateTenant(
  tenantId: number,
  payload: Partial<Pick<TenantDto, "name" | "isActive">>
): Promise<TenantDetailDto> {
  const res = await api.patch<TenantDetailDto>(`/core/tenants/${tenantId}/`, payload);
  return res.data;
}

/** GET list of owners for a tenant */
export async function getTenantOwners(tenantId: number): Promise<TenantOwnerDto[]> {
  const res = await api.get<TenantOwnerDto[]>(`/core/tenants/${tenantId}/owners/`);
  return res.data;
}

/** POST register owner for tenant */
export async function registerTenantOwner(
  tenantId: number,
  payload: {
    username: string;
    password?: string;
    name?: string;
    phone?: string;
  }
): Promise<TenantOwnerDto> {
  const res = await api.post<TenantOwnerDto>(`/core/tenants/${tenantId}/owner/`, payload);
  return res.data;
}
