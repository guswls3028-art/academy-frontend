import { useState } from "react";

import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { extractApiError } from "@/shared/utils/extractApiError";

import { useAdminExam } from "../hooks/useAdminExam";
import { useExamAssets } from "../hooks/useExamAssets";
import AssetUploadSection from "../components/assets/AssetUploadSection";
import ExamPdfUploadModal from "../components/ExamPdfUploadModal";
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
    : status === "ready"
      ? `${exam.source_filename || "원본 시험지"}의 문항 분리가 완료되었습니다.`
      : status === "conversion_required"
        ? "HWP 원본은 보관되었습니다. 수식과 배치를 보존하도록 PDF로 저장해 추가로 올려 주세요."
        : status === "failed"
          ? "문항 분리를 완료하지 못했습니다. 원본을 확인하고 PDF를 다시 올려 주세요."
          : "PDF 원본을 올리면 표지와 일정표를 제외하고 문항별로 분리합니다.";
  const statusBadge = status === "ready"
    ? { tone: "success" as const, label: "준비됨" }
    : status === "processing"
      ? { tone: "info" as const, label: "처리 중" }
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
              {status === "none" ? "시험지 업로드" : "PDF 다시 올리기"}
            </Button>
          )}
        </div>

        {isTemplate && (
          <AssetUploadSection
            examId={examId}
            assetType="omr_sheet"
            title="OMR 답안지"
            accept="application/pdf"
          />
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
