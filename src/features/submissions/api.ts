// src/features/submissions/api.ts
// --------------------------------------------------
// Submission API (공통 엔드포인트)
// --------------------------------------------------
//
// ✔ 시험 / 과제 / 영상 업로드 전부 여기로
// ✔ 프론트는 R2 / Worker / AI를 절대 알 필요 없음
//

import api from "@/shared/api/axios";
import { Submission } from "./types";

/**
 * ✅ 제출 생성 (파일 업로드)
 *
 * formData 필수 필드 (backend contract):
 * - kind
 * - target_type (exam | homework | video)
 * - target_id
 * - file
 */
export async function createSubmission(formData: FormData) {
  const res = await api.post<Submission>(
    "/submissions/",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return res.data;
}

/**
 * ✅ 제출 상태 단건 조회 (Polling)
 */
export async function fetchSubmission(submissionId: number) {
  const res = await api.get<Submission>(
    `/submissions/${submissionId}/`
  );
  return res.data;
}

/**
 * ✅ 제출 재처리 (FAILED 상태 전용)
 * - 관리자 액션
 */
export async function retrySubmission(submissionId: number) {
  const res = await api.post(
    `/submissions/${submissionId}/retry/`
  );
  return res.data;
}
