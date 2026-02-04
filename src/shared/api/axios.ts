// ====================================================================================================
// PATH: src/shared/api/axios.ts
// ====================================================================================================
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// 디버그용 (원본 유지)
console.log("VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL);

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  withCredentials: true,
});

// ============================
// ✅ MULTI TENANT (FIX)
// - localStorage key SSOT: tenant_code
// ============================
api.interceptors.request.use((config) => {
  const tenantCode = localStorage.getItem("tenant_code");
  if (tenantCode) {
    config.headers = config.headers ?? {};
    config.headers["X-Tenant-Code"] = tenantCode;
  }
  return config;
});

// ============================
// Request: access token
// ============================
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================
// Response: refresh token
// ============================
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as any;

    // ❌ core/me 는 절대 redirect / refresh 트리거 금지
    if (original?.url?.includes("/core/me/")) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;

      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
        return Promise.reject(error); // ❌ 여기서도 redirect 금지
      }

      try {
        const res = await axios.post(
          `${API_BASE}/api/v1/token/refresh/`,
          { refresh }
        );

        const newAccess = res.data.access;
        localStorage.setItem("access", newAccess);

        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;

        return api(original);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
