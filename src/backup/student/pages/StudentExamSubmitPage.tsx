// src/student/pages/StudentExamSubmitPage.tsx
// --------------------------------------------------
// 학생 시험 OMR 업로드 페이지 (MVP)
// --------------------------------------------------
//
// ✔ Submission feature 100% 재사용
// ✔ R2 / Worker / AI 전부 프론트 무관
//

import { useState } from "react";
import { createSubmission } from "@/features/submissions/api";
import { useSubmissionPolling } from "@/features/submissions/hooks/useSubmissionPolling";
import { SubmissionStatusBadge } from "@/features/submissions/components/SubmissionStatusBadge";

type Props = {
  examId: number;
};

export default function StudentExamSubmitPage({ examId }: Props) {
  const [submissionId, setSubmissionId] =
    useState<number | null>(null);

  // ✅ Submission 상태 자동 추적
  const { data, isLoading } = useSubmissionPolling(
    submissionId ?? undefined
  );

  // -------------------------------
  // OMR 업로드
  // -------------------------------
  const handleUpload = async (file: File) => {
    const formData = new FormData();

    // backend contract (중요)
    formData.append("kind", "EXAM_OMR");
    formData.append("target_type", "exam");
    formData.append("target_id", String(examId));
    formData.append("file", file);

    const submission = await createSubmission(formData);
    setSubmissionId(submission.id);
  };

  return (
    <div className="max-w-md space-y-6">
      {/* ================= 안내 ================= */}
      <div className="rounded border bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium">📄 OMR 답안 업로드 안내</p>
        <ul className="mt-2 list-disc pl-4 space-y-1">
          <li>정면에서 촬영해주세요</li>
          <li>밝고 선명하게</li>
          <li>테두리가 잘 보이게</li>
        </ul>
      </div>

      {/* ================= 업로드 ================= */}
      {!submissionId && (
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            e.target.files &&
            handleUpload(e.target.files[0])
          }
          className="block w-full text-sm"
        />
      )}

      {/* ================= 상태 ================= */}
      {data && (
        <div className="space-y-3 rounded border p-4">
          <SubmissionStatusBadge status={data.status} />

          {data.status === "done" &&
            data.result_summary && (
              <div className="text-sm">
                <p>
                  점수:{" "}
                  <strong>
                    {data.result_summary.score} /{" "}
                    {data.result_summary.max_score}
                  </strong>
                </p>

                {data.result_summary.clinic_required && (
                  <p className="mt-2 text-red-600">
                    ⚠️ 클리닉 대상입니다. 안내를
                    확인해주세요.
                  </p>
                )}
              </div>
            )}

          {data.status === "failed" && (
            <div className="text-sm text-red-600">
              처리 실패했습니다. 다시 촬영 후
              업로드해주세요.
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="text-xs text-gray-400">
          처리 상태 확인 중...
        </div>
      )}
    </div>
  );
}
