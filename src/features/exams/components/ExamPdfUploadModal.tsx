// PATH: src/features/exams/components/ExamPdfUploadModal.tsx
// 공통 모달 — PDF 시험지 업로드 → AI 문항 분할
// FileUploadZone SSOT 재사용, usePdfQuestionExtract hook 사용

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
  uploading: "파일 업로드 중…",
  processing: "AI 문항 분할 진행 중…",
  done: "문항 분할 완료",
  failed: "문항 분할 실패",
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
    const file = files[0];
    setSelectedFile(file);
    upload(file);
  };

  const isProcessing = status === "uploading" || status === "processing";
  const isDone = status === "done";

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
        description="시험지 PDF 또는 이미지를 올리면 AI가 문항 영역을 자동 인식하여 각 문항 이미지를 생성합니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact" style={{ minHeight: 200 }}>
          <FileUploadZone
            titleLabel="시험지 PDF / 이미지"
            accept=".pdf,.png,.jpg,.jpeg"
            hintText="PDF, PNG, JPG 파일 (50MB 이하)"
            selectedFile={selectedFile}
            onFilesSelect={handleFilesSelect}
            onClearFile={() => {
              setSelectedFile(null);
              reset();
            }}
            disabled={isProcessing}
            validateFile={(f) => {
              const ext = f.name.toLowerCase();
              return ext.endsWith(".pdf") || ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg");
            }}
            onInvalidFile={() => {
              // feedback already handled by FileUploadZone
            }}
          />

          {/* 진행 상태 표시 */}
          {status !== "idle" && (
            <div className="mt-4 rounded border border-[var(--color-border-divider)] p-3">
              <div className="flex items-center gap-2">
                {isProcessing && (
                  <div className="w-4 h-4 border-2 border-[var(--color-brand-primary)] border-t-transparent rounded-full animate-spin" />
                )}
                {isDone && (
                  <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                {status === "failed" && (
                  <svg className="w-4 h-4 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                )}
                <span className={`text-sm font-medium ${
                  isDone ? "text-[var(--color-success)]" :
                  status === "failed" ? "text-[var(--color-error)]" :
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
                  문항 이미지가 생성되었습니다. 이미지 등록 탭에서 확인하세요.
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
              <Button intent="secondary" onClick={onClose} disabled={isProcessing}>
                {isProcessing ? "처리 중…" : "닫기"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
