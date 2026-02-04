// ====================================================================================================
// FILE: src/features/submissions/dev/SubmissionTestPanel.tsx
// (선택: 즉시 체감 테스트 버튼 유지)
// ====================================================================================================
import { createSubmission } from "../api";

export async function handleUploadTest(file: File, examId: number) {
  const formData = new FormData();
  formData.append("enrollment_id", "1");
  formData.append("target_type", "exam");
  formData.append("target_id", String(examId));
  formData.append("source", "omr_scan");
  formData.append("file", file);
  return createSubmission(formData);
}
