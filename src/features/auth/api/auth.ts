// PATH: src/features/auth/api/auth.ts
import api from "@/shared/api/axios";

// ⚠️ 구조/로직 유지
// ⚠️ axios 직접 사용만 제거
export const login = async (username: string, password: string) => {
  const res = await api.post(
    "/token/",
    { username, password }
  );

  localStorage.setItem("access", res.data.access);
  localStorage.setItem("refresh", res.data.refresh);

  return res.data;
};

export const logout = () => {
  localStorage.clear();
  window.location.href = "/login";
};
