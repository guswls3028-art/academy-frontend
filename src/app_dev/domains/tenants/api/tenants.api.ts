// PATH: src/dev_app/api/tenants.ts
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
  phone?: string;
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

/** PATCH update owner (name, phone) */
export async function updateTenantOwner(
  tenantId: number,
  userId: number,
  payload: { name?: string; phone?: string }
): Promise<TenantOwnerDto> {
  const res = await api.patch<TenantOwnerDto>(
    `/core/tenants/${tenantId}/owners/${userId}/`,
    payload
  );
  return res.data;
}

/** DELETE remove owner from tenant (membership deactivated) */
export async function removeTenantOwner(
  tenantId: number,
  userId: number
): Promise<void> {
  await api.delete(`/core/tenants/${tenantId}/owners/${userId}/`);
}

/* ===== Dev: Usage / Activity / Impersonate ===== */

export type TenantUsageDto = {
  tenant: { id: number; code: string; name: string; is_active: boolean };
  users: {
    students: number;
    teachers: number;
    parents: number;
    memberships_by_role: Record<string, number>;
    last_login_at: string | null;
  };
  videos: { total: number; active: number; processing: number; failed: number };
  messaging: { sent_30d: number; failed_30d: number };
  billing: null | {
    plan: string;
    plan_display: string;
    monthly_price: number;
    subscription_status: string;
    subscription_status_display: string;
    subscription_expires_at: string | null;
    next_billing_at: string | null;
    days_remaining: number | null;
    cancel_at_period_end: boolean;
  };
};

export async function getTenantUsage(tenantId: number): Promise<TenantUsageDto> {
  const res = await api.get<TenantUsageDto>(`/core/dev/tenants/${tenantId}/usage/`);
  return res.data;
}

export type TenantActivityEntry = {
  id: number;
  created_at: string | null;
  actor: string;
  action: string;
  summary: string;
  result: "success" | "failed";
  error: string;
  payload: unknown;
};

export async function getTenantActivity(tenantId: number): Promise<{ results: TenantActivityEntry[]; count: number }> {
  const res = await api.get<{ results: TenantActivityEntry[]; count: number }>(
    `/core/dev/tenants/${tenantId}/activity/`,
  );
  return res.data;
}

export type ImpersonateResponse = {
  access: string;
  refresh: string;
  target: { user_id: number; username: string; role: string; tenant_id: number; tenant_code: string };
};

export async function impersonateTenantUser(tenantId: number, userId: number): Promise<ImpersonateResponse> {
  const res = await api.post<ImpersonateResponse>(
    `/core/dev/tenants/${tenantId}/impersonate/`,
    { user_id: userId },
  );
  return res.data;
}

export type TenantStorageDto = {
  tenant_id: number;
  tenant_code: string;
  prefix: string;
  bytes: number;
  objects: number;
  calculated_at: string;
  cache_ttl: number;
  cached: boolean;
};

export async function getTenantStorage(tenantId: number, opts?: { refresh?: boolean }): Promise<TenantStorageDto> {
  const res = await api.get<TenantStorageDto>(
    `/core/dev/tenants/${tenantId}/storage/`,
    { params: opts?.refresh ? { refresh: 1 } : undefined },
  );
  return res.data;
}
