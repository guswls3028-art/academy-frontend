// PATH: src/features/exams/components/ExamPdfUploadModal.tsx
// 통합 모달 — 시험지 PDF 업로드 (POST /exams/{examId}/assets/)
// 진입점: ExamAssetsPanel(자산 탭), AnswerKeyRegisterModal(답안 등록)

import { useState, useEffect } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";
import { usePdfQuestionExtract, type PdfExtractStatus } from "../hooks/usePdfQuestionExtract";

type Props = {
  open: boolean;
  onClose: () => void;
  examId: number;
};

const STATUS_LABELS: Record<PdfExtractStatus, string> = {
  idle: "",
  uploading: "시험지 업로드 중…",
  done: "업로드 완료",
  failed: "업로드 실패",
};

export default function ExamPdfUploadModal({ open, onClose, examId }: Props) {
  const { status, error, upload, reset } = usePdfQuestionExtract(examId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      reset();
    }
  }, [open, reset]);

  const handleFilesSelect = (files: File[]) => {
    if (files.length === 0) return;
    setSelectedFile(files[0]);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    upload(selectedFile);
  };

  const isUploading = status === "uploading";
  const isDone = status === "done";
  const isFailed = status === "failed";

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.sm}
    >
      <ModalHeader
        type="action"
        title="시험지 PDF 업로드"
        description="시험지 PDF 파일을 업로드합니다. 업로드된 파일은 시험 자산으로 저장됩니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact" style={{ minHeight: 200 }}>
          <FileUploadZone
            titleLabel="시험지 PDF"
            accept=".pdf,.png,.jpg,.jpeg"
            hintText="PDF, PNG, JPG 파일 (50MB 이하)"
            selectedFile={selectedFile}
            onFilesSelect={handleFilesSelect}
            onClearFile={() => {
              setSelectedFile(null);
              reset();
            }}
            disabled={isUploading}
            validateFile={(f) => {
              const ext = f.name.toLowerCase();
              return ext.endsWith(".pdf") || ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg");
            }}
            onInvalidFile={() => {}}
          />

          {/* 진행 상태 표시 */}
          {status !== "idle" && (
            <div className="mt-4 rounded border border-[var(--color-border-divider)] p-3">
              <div className="flex items-center gap-2">
                {isUploading && (
                  <div className="w-4 h-4 border-2 border-[var(--color-brand-primary)] border-t-transparent rounded-full animate-spin" />
                )}
                {isDone && (
                  <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                {isFailed && (
                  <svg className="w-4 h-4 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                )}
                <span className={`text-sm font-medium ${
                  isDone ? "text-[var(--color-success)]" :
                  isFailed ? "text-[var(--color-error)]" :
                  "text-[var(--color-text-primary)]"
                }`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
              {error && (
                <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>
              )}
              {isDone && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  시험지 PDF가 자산으로 저장되었습니다.
                </p>
              )}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            {isDone ? (
              <Button intent="primary" onClick={onClose}>확인</Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button intent="secondary" onClick={onClose} disabled={isUploading}>
                  닫기
                </Button>
                {selectedFile && status === "idle" && (
                  <Button intent="primary" onClick={handleUpload}>
                    업로드
                  </Button>
                )}
                {isUploading && (
                  <Button intent="primary" disabled>
                    업로드 중…
                  </Button>
                )}
                {isFailed && selectedFile && (
                  <Button intent="primary" onClick={handleUpload}>
                    재시도
                  </Button>
                )}
              </div>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
