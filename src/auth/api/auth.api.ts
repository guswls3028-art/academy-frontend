// PATH: src/app_admin/domains/auth/api/auth.ts
import api, { clearTokens, resetSessionEnding } from "@/shared/api/axios";
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
    const ax = err as {
      response?: { status?: number; data?: { detail?: string | string[] | Record<string, unknown> } };
      code?: string;
    };
    const status = ax?.response?.status;
    // 응답 자체가 없으면 네트워크/CORS 이슈 — 자격 증명 오류와 분리
    if (!ax?.response) {
      throw new Error("서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.");
    }
    // 5xx는 서버 측 이슈 — "비밀번호 확인" 오안내를 피한다
    if (typeof status === "number" && status >= 500) {
      throw new Error("서버에 일시적 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
    // 401/400 = 자격 증명 오류 — username enumeration 방지 + 사용자 친화 문구
    if (status === 401 || status === 400) {
      throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    const detail = ax?.response?.data?.detail;
    let msg = "로그인에 실패했습니다.";
    if (typeof detail === "string") msg = detail;
    else if (Array.isArray(detail) && detail.length) msg = String(detail[0]);
    else if (detail && typeof detail === "object")
      msg = String(Object.values(detail).flat().find(Boolean) ?? msg);
    throw new Error(msg);
  }

  const access = String(res.data?.access || "").trim();
  const refresh = String(res.data?.refresh || "").trim();

  if (!access || !refresh) {
    throw new Error("Invalid token response");
  }

  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
  resetSessionEnding(); // 재로그인 시 세션 종료 플래그 초기화

  return res.data;
};

export const logout = () => {
  clearTokens();
  window.location.href = "/";
};
