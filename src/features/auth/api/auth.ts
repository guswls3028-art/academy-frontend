// PATH: src/features/auth/api/auth.ts
import api from "@/shared/api/axios";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

export type LoginResponse = {
  access: string;
  refresh: string;
};

export const login = async (username: string, password: string) => {
  const tenantCode = getTenantCodeForApiRequest();
  const body: Record<string, string> = { username, password };
  if (tenantCode) body.tenant_code = tenantCode;

  let res;
  try {
    res = await api.post<LoginResponse>("/token/", body);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { detail?: string | Record<string, unknown> } } };
    const detail = ax?.response?.data?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object"
          ? (detail as { detail?: string }).detail ?? JSON.stringify(detail)
          : "로그인에 실패했습니다.";
    throw new Error(msg);
  }

  const access = String(res.data?.access || "").trim();
  const refresh = String(res.data?.refresh || "").trim();

  if (!access || !refresh) {
    throw new Error("Invalid token response");
  }

  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);

  return res.data;
};

export const logout = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  window.location.href = "/login";
};
