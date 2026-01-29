// src/features/auth/api/auth.ts
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const login = async (username: string, password: string) => {
  const res = await axios.post(
    `${API_BASE}/api/v1/token/`,
    { username, password },
    { withCredentials: true }
  );

  localStorage.setItem("access", res.data.access);
  localStorage.setItem("refresh", res.data.refresh);

  return res.data;
};

export const logout = () => {
  localStorage.clear();
  window.location.href = "/login";
};
