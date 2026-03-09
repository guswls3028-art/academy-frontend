/**
 * ExamAssetsPanel (Production)
 * - assets 단일진실: GET /exams/{id}/assets/ (regular도 template resolve)
 * - template에서만 업로드 UI 노출(봉인 정책 존중)
 */

import { useAdminExam } from "../hooks/useAdminExam";
import { useExamAssets } from "../hooks/useExamAssets";

import AssetUploadSection from "../components/assets/AssetUploadSection";
import BlockReason from "../components/BlockReason";

export default function ExamAssetsPanel({ examId }: { examId: number }) {
  const { data: exam } = useAdminExam(examId);
  const q = useExamAssets(examId);

  if (!exam) return null;

  const isTemplate = exam.exam_type === "template";

  return (
    <div className="space-y-4">
      {q.isLoading && (
        <div className="text-sm text-[var(--text-muted)]">
          자산 불러오는 중...
        </div>
      )}

      {q.isError && (
        <BlockReason
          title="자산 조회 실패"
          description={
            String((q.error as any)?.response?.data?.detail || "자산 정보를 불러오지 못했습니다.")
          }
        />
      )}

      {!q.isLoading && !q.isError && isTemplate && (
        <div className="space-y-4">
          <AssetUploadSection
            examId={examId}
            assetType="problem_pdf"
            title="시험지 PDF"
            accept="application/pdf"
          />

          <AssetUploadSection
            examId={examId}
            assetType="omr_sheet"
            title="OMR 답안지"
            accept="application/pdf"
          />
        </div>
      )}
    </div>
  );
}
