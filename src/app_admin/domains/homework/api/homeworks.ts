// PATH: src/app_admin/domains/homework/api/homeworks.ts
/**
 * Homework List/Create API
 *
 * ✅ 목표
 * - SessionAssessmentSidePanel(세션 공용탭)에서 생성/삭제/선택 흐름을 시험과 동일하게 유지
 * - 백엔드 endpoint/필드명이 약간 달라도 프론트가 흡수 (session vs session_id)
 */

import api from "@/shared/api/axios";
import {
  normalizeAssessmentPhaseStatus,
  type AssessmentPhaseStatus,
} from "@/shared/api/contracts/assessmentStatus";

export type HomeworkListItem = {
  id: number;
  title: string;
  status: AssessmentPhaseStatus;
  session_id?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asPositiveNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.items)) return record.items;
  return [];
}

function normalizeListItem(raw: unknown): HomeworkListItem {
  const record = asRecord(raw);
  const sid = record.session_id ?? record.session ?? record.sessionId;

  return {
    id: Number(record.id),
    title: String(record.title ?? ""),
    status: normalizeAssessmentPhaseStatus(record.status),
    session_id: asPositiveNumber(sid) ?? undefined,
  };
}

export async function fetchHomeworks(params?: { session_id?: number }): Promise<HomeworkListItem[]> {
  const res = await api.get("/homeworks/", { params });
  return unwrapList(res.data).map(normalizeListItem);
}

/**
 * ✅ POST /homeworks/
 * - 상태는 서버 기본값(DRAFT) 사용.
 * - template_homework_id 있으면 해당 템플릿을 불러와 이 차시에 적용.
 */
export async function createHomework(payload: {
  session_id: number;
  title: string;
  template_homework_id?: number;
}) {
  const res = await api.post("/homeworks/", {
    session_id: payload.session_id,
    session: payload.session_id,
    title: payload.title,
    ...(payload.template_homework_id != null ? { template_homework_id: payload.template_homework_id } : {}),
  });

  return res.data;
}

/**
 * ✅ DELETE /homeworks/{id}/
 */
export async function deleteHomework(homeworkId: number) {
  const res = await api.delete(`/homeworks/${homeworkId}/`);
  return res.data;
}
