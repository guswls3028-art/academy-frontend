// PATH: src/app_admin/domains/scores/api/patchItemScore.ts
/**
 * Subjective item score patch (Results 도메인 단일 계약)
 * - optimistic update 금지
 */

import api, { createAuthSessionBoundConfig } from "@/shared/api/axios";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { scoreEditorRequestHeaders } from "./scoreDraft";
import { trackScoreDraftWrite } from "@/shared/scoring/scoreEditLease";

export async function patchExamItemScore(params: {
  sessionId: number;
  examId: number;
  enrollmentId: number;
  questionId: number;
  score: number;
  answer?: string;
  authScope?: { generation: string; tenant: string };
}) {
  const { sessionId, examId, enrollmentId, questionId, score, answer } = params;
  const generation = params.authScope?.generation ?? readAuthTokenEnvelopeSafely()?.generation;
  const tenant = params.authScope?.tenant ?? getTenantCodeForApiRequest();
  if (!generation || !tenant) throw new Error("로그인과 학원 정보를 확인한 뒤 다시 저장해 주세요.");
  const config = createAuthSessionBoundConfig(generation, undefined, tenant);

  const payload: Record<string, unknown> = { score };
  if (answer !== undefined) payload.answer = answer;

  const res = await trackScoreDraftWrite(sessionId, async () => api.patch(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/items/${questionId}/`,
    payload,
    {
      ...config,
      headers: {
        ...await scoreEditorRequestHeaders(),
        "X-Score-Session-Id": String(sessionId),
      },
    },
  ));

  return res.data;
}
