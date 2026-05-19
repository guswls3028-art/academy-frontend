// PATH: src/app_admin/domains/homework/api/homeworkPolicy.ts
/**
 * HomeworkPolicy API
 *
 * ✅ 목표
 * - 커트라인 모드(PERCENT/COUNT) + 값(cutline_value) 관리
 * - 반올림 단위 유지
 *
 * 🔒 계약
 * - POST 없음 (프론트 생성 금지)
 * - passed/clinic 판단은 서버 단일 진실
 */

import api from "@/shared/api/axios";
import type { HomeworkPolicy, HomeworkCutlineMode } from "../types";

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  return Array.isArray(record.results) ? record.results : [];
}

function normalize(raw: unknown): HomeworkPolicy {
  const record = asRecord(raw);
  const session = Number(record.session ?? record.session_id ?? 0);

  // 서버가 새 스펙을 이미 지원하는 경우
  const modeRaw = String(record.cutline_mode ?? "").toUpperCase();
  const mode: HomeworkCutlineMode =
    modeRaw === "COUNT" ? "COUNT" : "PERCENT";

  const valueRaw =
    record.cutline_value ??
    // ⛑️ 구형 호환: cutline_percent만 있으면 percent 모드로 흡수
    record.cutline_percent ??
    80;

  return {
    id: Number(record.id),
    session,

    cutline_mode: mode,
    cutline_value: Number(valueRaw),

    round_unit_percent: Number(record.round_unit_percent ?? 5),

    created_at: String(record.created_at ?? ""),
    updated_at: String(record.updated_at ?? ""),
  };
}

export async function fetchHomeworkPolicyBySession(
  sessionId: number
): Promise<HomeworkPolicy | null> {
  if (!Number.isFinite(sessionId) || sessionId <= 0) return null;

  const res = await api.get("/homework/policies/", {
    params: { session: sessionId },
  });

  const data = res.data;
  const list = unwrapList(data);

  if (list.length === 0) return null;
  return normalize(list[0]);
}

/**
 * PATCH /homework/policies/{id}/
 *
 * payload 예시:
 * - { cutline_mode:"PERCENT", cutline_value:70, round_unit_percent:5 }
 * - { cutline_mode:"COUNT", cutline_value:40 }
 */
export async function patchHomeworkPolicy(
  id: number,
  payload: Partial<
    Pick<HomeworkPolicy, "cutline_mode" | "cutline_value" | "round_unit_percent">
  >
): Promise<HomeworkPolicy> {
  const res = await api.patch(`/homework/policies/${id}/`, payload);
  return normalize(res.data);
}
