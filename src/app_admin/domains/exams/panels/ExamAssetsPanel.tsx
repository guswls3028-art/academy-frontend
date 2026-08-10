import { useState } from "react";

import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { extractApiError } from "@/shared/utils/extractApiError";

import { useAdminExam } from "../hooks/useAdminExam";
import { useExamAssets } from "../hooks/useExamAssets";
import AssetUploadSection from "../components/assets/AssetUploadSection";
import ExamPdfUploadModal from "../components/ExamPdfUploadModal";
import ExamSegmentationReview from "../components/ExamSegmentationReview";
import BlockReason from "../components/BlockReason";

export default function ExamAssetsPanel({ examId }: { examId: number }) {
  const { data: exam } = useAdminExam(examId);
  const assetsQuery = useExamAssets(examId);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  if (!exam) return null;

  const isTemplate = exam.exam_type === "template";
  const canUploadRegularSource =
    !isTemplate && ["none", "failed", "conversion_required"].includes(exam.segmentation_status);
  const status = exam.segmentation_status;
  const statusCopy = status === "processing"
    ? "문항을 분리하고 있습니다. 완료되면 이 화면에 반영됩니다."
    : status === "review_required"
      ? "자동 분리된 문제와 선생님 원본 해설의 번호를 확인하고 확정해 주세요."
    : status === "ready"
      ? `${exam.source_filename || "원본 시험지"}의 문항 분리가 완료되었습니다.`
      : status === "conversion_required"
        ? "원본은 형식 그대로 보관되었습니다. 자동 분리가 완전하지 않으면 문항과 해설을 직접 등록해 검수해 주세요."
        : status === "failed"
          ? "문항 분리를 완료하지 못했습니다. 원본을 확인하거나 문항을 직접 등록해 주세요."
          : "자료 원본을 올리면 지원 형식은 자동 분리하고, 나머지 형식도 그대로 보관합니다.";
  const statusBadge = status === "ready"
    ? { tone: "success" as const, label: "준비됨" }
    : status === "processing"
      ? { tone: "info" as const, label: "처리 중" }
      : status === "review_required"
        ? { tone: "warning" as const, label: "검수 필요" }
      : status === "failed"
        ? { tone: "danger" as const, label: "확인 필요" }
        : { tone: "warning" as const, label: "등록 필요" };

  if (assetsQuery.isLoading) {
    return <EmptyState mode="embedded" scope="panel" tone="loading" title="시험 자료 불러오는 중…" />;
  }

  if (assetsQuery.isError) {
    return (
      <BlockReason
        title="시험 자료를 불러오지 못했습니다"
        description={extractApiError(assetsQuery.error, "잠시 후 다시 시도해 주세요.")}
      />
    );
  }

  return (
    <section id="assessment-materials" tabIndex={-1} className={formStyles.section}>
      <div className={formStyles.header}>
        <div>
          <h2 className={formStyles.title}>시험지 원본</h2>
          <p className={formStyles.description}>학생에게 배부한 시험지와 문항 분리 상태를 관리합니다.</p>
        </div>
        <Badge tone={statusBadge.tone} size="md" shape="square">{statusBadge.label}</Badge>
      </div>

      <div className={formStyles.body}>
        <div className={formStyles.inlineStatus}>
          <div>
            <strong>{status === "ready" ? "시험지 원본 준비 완료" : "시험지 원본 확인"}</strong>
            <p>{statusCopy}</p>
          </div>
          {(isTemplate || canUploadRegularSource) && (
            <Button type="button" intent="secondary" size="sm" onClick={() => setPdfModalOpen(true)}>
              {status === "none" ? "시험 자료 업로드" : "자료 다시 올리기"}
            </Button>
          )}
        </div>

        {isTemplate && (
          <AssetUploadSection
            examId={examId}
            assetType="omr_sheet"
            title="OMR 답안지"
          />
        )}

        {status === "review_required" && (
          <ExamSegmentationReview examId={examId} />
        )}
      </div>

      <ExamPdfUploadModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        examId={examId}
      />
    </section>
  );
}
