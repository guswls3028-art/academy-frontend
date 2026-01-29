// src/student/shared/api/studentApi.ts
/**
 * ✅ studentApi (LOCK v1)
 * - 학생 전용 API wrapper
 * - 내부적으로 shared axios를 그대로 사용 (모노레포 공존)
 *
 * 원칙:
 * - baseURL / auth / interceptors는 shared/api/axios가 책임
 * - student는 "호출"만 한다 (판단/계산 ❌)
 */

import api from "@/shared/api/axios";

export default api;
