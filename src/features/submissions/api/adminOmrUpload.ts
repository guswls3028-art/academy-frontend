// PATH: src/features/submissions/api/adminOmrUpload.ts

import api from "@/shared/api/axios";
// ✅ [수정] SubmissionStatus는 submissions 도메인 타입을 사용해야 함
// (기존) import type { SubmissionStatus } from "@/features/exams/types";
import type { SubmissionStatus } from "@/features/submissions/types";

// ✅ 너의 현재 백엔드 라우터 기준(기본값)
// - 만약 서버를 정리해서 /submissions/... 로 만들면 아래만 바꾸면 됨.
const SUBMISSIONS_BASE = "/submissions/submissions";

export interface AdminOmrUploadResponse {
  submission_id: number;
  status: SubmissionStatus;
}

/**
 * POST /api/v1/submissions/submissions/admin/omr-upload/
 * form-data: enrollment_id, target_id(exam_id), file
 */
export async function adminOmrUpload(params: {
  examId: number;
  enrollmentId: number;
  file: File;
}): Promise<AdminOmrUploadResponse> {
  const fd = new FormData();
  fd.append("enrollment_id", String(params.enrollmentId));
  fd.append("target_id", String(params.examId));
  fd.append("file", params.file);

  const res = await api.post(`${SUBMISSIONS_BASE}/admin/omr-upload/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

/**
 * POST /api/v1/submissions/submissions/{id}/retry/
 */
export async function retrySubmission(submissionId: number): Promise<{
  submission_id: number;
  status: SubmissionStatus;
}> {
  const res = await api.post(`${SUBMISSIONS_BASE}/${submissionId}/retry/`);
  return res.data;
}
