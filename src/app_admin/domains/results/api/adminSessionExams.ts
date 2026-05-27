// PATH: src/app_admin/domains/results/api/adminSessionExams.ts

import api from "@/shared/api/axios";
import {
  normalizeAssessmentPhaseStatus,
  type AssessmentPhaseStatus,
} from "@/shared/api/contracts/assessmentStatus";

export type SessionExamRow = {
  exam_id: number;
  title: string;
  /** 과제와 동일: DRAFT=설정 중, OPEN=진행 중, CLOSED=마감 */
  status: AssessmentPhaseStatus;
  open_at: string | null;
  close_at: string | null;
  allow_retake: boolean;
  max_attempts: number;
  display_order?: number;
};

function normalizeRow(raw: unknown): SessionExamRow {
  const record = raw != null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  return {
    exam_id: Number(record.exam_id),
    title: String(record.title ?? ""),
    status: normalizeAssessmentPhaseStatus(record.status),
    open_at: typeof record.open_at === "string" ? record.open_at : null,
    close_at: typeof record.close_at === "string" ? record.close_at : null,
    allow_retake: Boolean(record.allow_retake),
    max_attempts: Number(record.max_attempts ?? 1),
    display_order: record.display_order == null ? undefined : Number(record.display_order),
  };
}

export async function fetchAdminSessionExams(sessionId: number): Promise<SessionExamRow[]> {
  const res = await api.get(
    `/results/admin/sessions/${sessionId}/exams/`
  );

  const d = res.data;

  // ✅ 방어 파싱만 추가 (이것만)
  if (Array.isArray(d)) return d.map(normalizeRow);
  if (Array.isArray(d?.items)) return d.items.map(normalizeRow);
  if (Array.isArray(d?.results)) return d.results.map(normalizeRow);

  return [];
}
