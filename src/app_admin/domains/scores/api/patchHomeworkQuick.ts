// PATH: src/app_admin/domains/scores/api/patchHomeworkQuick.ts
/**
 * Homework Quick Patch API
 *
 * ✅ LOCKED SPEC
 * - PATCH /homework/scores/quick/
 * - 프론트는 계산/판정 금지 → 서버 결과만 신뢰
 *
 * ✅ 확장(최소):
 * - meta_status: "NOT_SUBMITTED" | null (미제출 저장/해제)
 * - score: number | null (미입력/미제출을 위해 null 허용)
 */

import api from "@/shared/api/axios";
import { scoreEditorRequestHeaders } from "./scoreDraft";

export type HomeworkMetaStatus = "NOT_SUBMITTED";

export type HomeworkScoreCellValue = {
  score: number | null;
  max_score: number | null;
  meta_status: HomeworkMetaStatus | null;
  updated_at: string | null;
};

export type HomeworkScoreCellConflict = {
  detail: string;
  code: "SCORE_CELL_CONFLICT";
  serverValue: HomeworkScoreCellValue;
};

type HomeworkQuickPatchResult = {
  score: number | null;
  max_score: number | null;
  meta?: { status?: HomeworkMetaStatus | null } | null;
  updated_at: string;
};

export async function patchHomeworkQuick(params: {
  sessionId: number;
  enrollmentId: number;
  homeworkId: number;

  // ✅ 확장: null 허용
  score: number | null;

  maxScore?: number | null;

  // ✅ 확장: 미제출 저장/해제
  metaStatus?: HomeworkMetaStatus | null;
  expectedUpdatedAt: string | null;
}): Promise<HomeworkQuickPatchResult> {
  const res = await api.patch(
    "/homework/scores/quick/",
    {
      session_id: params.sessionId,
      enrollment_id: params.enrollmentId,
      homework_id: params.homeworkId,
      score: params.score,
      max_score: params.maxScore ?? null,
      meta_status: params.metaStatus ?? null,
      expected_updated_at: params.expectedUpdatedAt,
    },
    {
      headers: {
        ...await scoreEditorRequestHeaders(),
        "X-Score-Session-Id": String(params.sessionId),
      },
    },
  );

  return res.data as HomeworkQuickPatchResult;
}

export function getHomeworkScoreCellConflict(error: unknown): HomeworkScoreCellConflict | null {
  const response = (error as {
    response?: {
      status?: number;
      data?: {
        detail?: string;
        code?: string;
        server_value?: Partial<HomeworkScoreCellValue>;
      };
    };
  } | null)?.response;
  if (response?.status !== 409 || response.data?.code !== "SCORE_CELL_CONFLICT") return null;
  const value = response.data.server_value ?? {};
  return {
    detail: response.data.detail ?? "다른 화면에서 이 과제 점수가 먼저 저장되었습니다.",
    code: "SCORE_CELL_CONFLICT",
    serverValue: {
      score: typeof value.score === "number" ? value.score : null,
      max_score: typeof value.max_score === "number" ? value.max_score : null,
      meta_status: value.meta_status === "NOT_SUBMITTED" ? "NOT_SUBMITTED" : null,
      updated_at: typeof value.updated_at === "string" ? value.updated_at : null,
    },
  };
}
