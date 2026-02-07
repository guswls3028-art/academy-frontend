// PATH: src/features/auth/api/auth.ts
import api from "@/shared/api/axios";

export type LoginResponse = {
  access: string;
  refresh: string;
};

export const login = async (username: string, password: string) => {
  const res = await api.post<LoginResponse>("/token/", { username, password });

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
  // tenant은 운영 정책상 유지할지/지울지 선택인데,
  // 보안/격리 최우선이면 tenant도 clear 권장:
  // localStorage.removeItem("tenant_code");
  window.location.href = "/login";
};
