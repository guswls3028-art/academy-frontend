// PATH: src/admin_app/api/branding.ts
// Tenant branding: logo/image upload (R2) and ui_config. Backend API TBD.

import api from "@/shared/api/axios";

export type TenantBrandingDto = {
  tenantId: number;
  loginTitle?: string;
  loginSubtitle?: string;
  logoUrl?: string;
};

/** GET tenant branding (from Program.ui_config or Tenant). Backend TBD. */
export async function getTenantBranding(
  tenantId: number
): Promise<TenantBrandingDto | null> {
  try {
    const res = await api.get<TenantBrandingDto>(
      `/core/tenant-branding/${tenantId}/`
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

/** POST upload logo image for tenant. Backend uploads to R2, returns logoUrl. */
export async function uploadTenantLogo(
  tenantId: number,
  file: File
): Promise<{ logoUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<{ logoUrl: string }>(
    `/core/tenant-branding/${tenantId}/upload-logo/`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return res.data;
}

/** PATCH tenant branding (loginTitle, logoUrl, etc.). Backend TBD. */
export async function patchTenantBranding(
  tenantId: number,
  payload: Partial<TenantBrandingDto>
): Promise<TenantBrandingDto> {
  const res = await api.patch<TenantBrandingDto>(
    `/core/tenant-branding/${tenantId}/`,
    payload
  );
  return res.data;
}
