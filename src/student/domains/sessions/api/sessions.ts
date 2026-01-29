// src/student/domains/sessions/api/sessions.ts
/**
 * ✅ Student Sessions API (LOCK v1)
 *
 * 권장 엔드포인트(예시):
 * - GET /api/v1/sessions/me/           -> 내가 접근 가능한 차시 목록
 * - GET /api/v1/sessions/{id}/         -> 차시 상세(행동 허브용)
 *
 * 프론트 원칙:
 * - 정렬/상태판단 ❌
 * - 백엔드 제공 필드 그대로 렌더링 ✅
 */

import api from "@/student/shared/api/studentApi";

export type StudentSession = {
  id: number;
  title: string;
  date?: string | null;
  status?: string | null;

  // 허브 확장 필드(있으면 그대로 받음)
  media_url?: string | null;
  exam_ids?: number[] | null;
  assignment_ids?: number[] | null;
};

export async function fetchMySessions(): Promise<StudentSession[]> {
  const res = await api.get("/sessions/me/");
  const data = res.data;
  if (Array.isArray(data)) return data as StudentSession[];
  if (Array.isArray(data?.items)) return data.items as StudentSession[];
  return [];
}

export async function fetchSessionDetail(sessionId: number): Promise<StudentSession> {
  const res = await api.get(`/sessions/${sessionId}/`);
  return res.data as StudentSession;
}
