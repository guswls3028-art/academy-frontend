// PATH: src/features/submissions/api/submissions.ts
import api from "@/shared/api/axios";

export async function manualIdentifySubmission(
  submissionId: number,
  studentId: number
): Promise<void> {
  await api.post(`/submissions/${submissionId}/manual-identify/`, {
    student_id: studentId,
  });
}
