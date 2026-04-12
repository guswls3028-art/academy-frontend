/**
 * ExamAssetsPanel (Production)
 * - assets 단일진실: GET /exams/{id}/assets/ (regular도 template resolve)
 * - template에서만 업로드 UI 노출(봉인 정책 존중)
 * - 시험지 PDF: ExamPdfUploadModal (통합 모달) — AnswerKeyRegisterModal과 동일
 * - OMR 답안지: AssetUploadSection (인라인)
 */

import { useState } from "react";
import { useAdminExam } from "../hooks/useAdminExam";
import { useExamAssets } from "../hooks/useExamAssets";

import AssetUploadSection from "../components/assets/AssetUploadSection";
import ExamPdfUploadModal from "../components/ExamPdfUploadModal";
import BlockReason from "../components/BlockReason";

export default function ExamAssetsPanel({ examId }: { examId: number }) {
  const { data: exam } = useAdminExam(examId);
  const q = useExamAssets(examId);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

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
          title="파일을 불러오지 못했습니다"
          description={
            String((q.error as any)?.response?.data?.detail || "자산 정보를 불러오지 못했습니다.")
          }
        />
      )}

      {!q.isLoading && !q.isError && isTemplate && (
        <div className="space-y-4">
          {/* 시험지 PDF — 통합 모달 */}
          <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  시험지 PDF
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  운영 시험 제출/채점에 필요합니다.
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setPdfModalOpen(true)}
              >
                시험지 업로드
              </button>
            </div>
          </div>

          <ExamPdfUploadModal
            open={pdfModalOpen}
            onClose={() => setPdfModalOpen(false)}
            examId={examId}
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
