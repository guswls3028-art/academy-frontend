// PATH: src/features/exams/components/ExamPdfUploadModal.tsx
// 통합 모달 — 시험지 PDF 업로드 + AI 문항 분할 진행률 + 결과 표시
// 진입점: ExamAssetsPanel(자산 탭), AnswerKeyRegisterModal(답안 등록)

import { useState, useEffect } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";
import {
  usePdfQuestionExtract,
  type PdfExtractStatus,
} from "../hooks/usePdfQuestionExtract";

type Props = {
  open: boolean;
  onClose: () => void;
  examId: number;
};

const STATUS_LABELS: Record<PdfExtractStatus, string> = {
  idle: "",
  uploading: "시험지 업로드 중…",
  processing: "AI 문항 분할 처리 중…",
  done: "문항 분할 완료",
  failed: "처리 실패",
};

export default function ExamPdfUploadModal({ open, onClose, examId }: Props) {
  const { status, error, progress, result, upload, reset } = usePdfQuestionExtract(examId);
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
  const isProcessing = status === "processing";
  const isDone = status === "done";
  const isFailed = status === "failed";
  const isBusy = isUploading || isProcessing;

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
        description="시험지 PDF를 업로드하면 AI가 문항을 자동으로 인식합니다."
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
            disabled={isBusy}
            validateFile={(f) => {
              const ext = f.name.toLowerCase();
              return ext.endsWith(".pdf") || ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg");
            }}
            onInvalidFile={() => {}}
          />

          {/* 진행 상태 표시 */}
          {status !== "idle" && (
            <div className="mt-4 rounded border border-[var(--color-border-divider)] p-3">
              {/* 상태 아이콘 + 라벨 */}
              <div className="flex items-center gap-2">
                {isBusy && (
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

              {/* 프로그레스 바 (처리 중일 때) */}
              {isBusy && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all duration-500"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  {progress.stepName && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {progress.stepName}
                      {progress.stepIndex && progress.stepTotal
                        ? ` (${progress.stepIndex}/${progress.stepTotal})`
                        : ""}
                    </p>
                  )}
                </div>
              )}

              {/* 에러 메시지 */}
              {error && (
                <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>
              )}

              {/* 성공 결과 */}
              {isDone && result && (
                <div className="mt-2 text-xs text-[var(--color-text-muted)] space-y-0.5">
                  <p>인식된 문항 수: <strong className="text-[var(--color-text-primary)]">{result.totalQuestions}개</strong></p>
                  {result.explanationCount > 0 && (
                    <p>인식된 해설: <strong className="text-[var(--color-text-primary)]">{result.explanationCount}개</strong></p>
                  )}
                  {result.pageCount > 1 && (
                    <p>페이지 수: {result.pageCount}페이지</p>
                  )}
                  <p className="mt-1 text-[var(--color-text-tertiary)]">
                    문항 목록에서 결과를 확인하고 수정할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 파일만 저장된 경우 (AI 분할 전) */}
              {isUploading && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  파일 업로드 후 AI 문항 분할이 자동으로 시작됩니다.
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
                <Button intent="secondary" onClick={onClose} disabled={isBusy}>
                  닫기
                </Button>
                {selectedFile && status === "idle" && (
                  <Button intent="primary" onClick={handleUpload}>
                    업로드 및 문항 분석
                  </Button>
                )}
                {isBusy && (
                  <Button intent="primary" disabled>
                    {isProcessing ? "분석 중…" : "업로드 중…"}
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
