// src/student/shared/api/studentApi.ts
/**
 * ✅ studentApi (LOCK v1)
 * - 학생 전용 API wrapper
 * - 학부모 로그인 시 선택한 자녀 ID를 X-Student-Id 헤더로 자동 첨부
 */

import type { AxiosRequestConfig } from "axios";
import api from "@/shared/api/axios";
import { getParentStudentId } from "./parentStudentSelection";

function mergeStudentIdHeader(config?: AxiosRequestConfig): AxiosRequestConfig {
  const c = config ?? {};
  const id = getParentStudentId();
  if (id != null) {
    c.headers = { ...(c.headers as object), "X-Student-Id": String(id) };
  }
  return c;
}

export default {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    api.get<T>(url, mergeStudentIdHeader(config)),
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.post<T>(url, data, mergeStudentIdHeader(config)),
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.patch<T>(url, data, mergeStudentIdHeader(config)),
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.put<T>(url, data, mergeStudentIdHeader(config)),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    api.delete<T>(url, mergeStudentIdHeader(config)),
  request: <T = unknown>(config: AxiosRequestConfig) =>
    api.request<T>(mergeStudentIdHeader(config)),
};
