// PATH: src/features/legal/api/legal.api.ts
import api, { type ApiRequestConfig } from "@/shared/api/axios";

export type LegalConfig = {
  company_name: string;
  representative: string;
  business_number: string;
  ecommerce_number: string;
  address: string;
  support_email: string;
  support_phone: string;
  privacy_officer_name: string;
  privacy_officer_contact: string;
  terms_version: string;
  privacy_version: string;
  effective_date: string;
};

/** GET /core/legal-config/ — public, no auth needed */
export async function fetchLegalConfig(): Promise<LegalConfig> {
  const { data } = await api.get<LegalConfig>("/core/legal-config/", {
    skipAuth: true,
  } as ApiRequestConfig);
  return data;
}

/** PATCH /core/legal-config/ — owner only */
export async function updateLegalConfig(
  payload: Partial<Omit<LegalConfig, "terms_version" | "privacy_version" | "effective_date">>
): Promise<LegalConfig> {
  const { data } = await api.patch<LegalConfig>("/core/legal-config/", payload);
  return data;
}
