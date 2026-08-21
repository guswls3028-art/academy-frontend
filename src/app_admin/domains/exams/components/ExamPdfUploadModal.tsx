// PATH: src/app_admin/domains/exams/components/ExamPdfUploadModal.tsx
// 통합 모달 — 시험지 원본 업로드 + 문항·해설 맞춤 진행률 + 결과 표시
// 진입점: ExamAssetsPanel(자산 탭), AnswerKeyRegisterModal(답안 등록)

import { useState, useEffect } from "react";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";
import {
  usePdfQuestionExtract,
  type PdfExtractStatus,
} from "../hooks/usePdfQuestionExtract";
import styles from "./ExamPdfUploadModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  examId: number;
  sourceKind?: "exam" | "workbook";
};

const STATUS_LABELS: Record<PdfExtractStatus, string> = {
  idle: "",
  uploading: "시험 자료 업로드 중…",
  processing: "문항·정답·해설 맞춤 처리 중…",
  done: "자료 인식 완료 · 검수 필요",
  conversion_required: "원본 저장 완료 · 직접 검수 필요",
  failed: "처리 실패",
};

export default function ExamPdfUploadModal({ open, onClose, examId, sourceKind = "exam" }: Props) {
  const { status, error, progress, result, upload, reset } = usePdfQuestionExtract(examId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [explanationFile, setExplanationFile] = useState<File | null>(null);
  const [showSeparateFiles, setShowSeparateFiles] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setAnswerFile(null);
      setExplanationFile(null);
      setShowSeparateFiles(false);
      reset();
    }
  }, [open, reset]);

  const handleFilesSelect = (files: File[]) => {
    if (files.length === 0) return;
    setSelectedFile(files[0]);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    upload(selectedFile, answerFile, explanationFile);
  };

  const isUploading = status === "uploading";
  const isProcessing = status === "processing";
  const isDone = status === "done";
  const isConversionRequired = status === "conversion_required";
  const isFailed = status === "failed";
  const isBusy = isUploading || isProcessing;
  const progressValue = Math.min(100, Math.max(0, progress.percent));
  const sourceLabel = sourceKind === "workbook" ? "워크북" : "시험";
  const statusLabel = status === "uploading"
    ? `${sourceLabel} 자료 업로드 중…`
    : STATUS_LABELS[status];

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.md}
    >
      <ModalHeader
        type="action"
        title={`${sourceLabel} 자료 올리기`}
        description="문제지·정답지·해설지 원본을 역할별로 보존하고 문항 번호로 맞춥니다."
      />

      <ModalBody>
        <div className={`modal-scroll-body modal-scroll-body--compact ${styles.body}`}>
          <div className={styles.sourceModes} aria-label="지원하는 자료 구성">
            <div>
              <strong>한 파일</strong>
              <span>모든 안전한 원본 형식</span>
            </div>
            <div>
              <strong>문제지 + 정답지</strong>
              <span>번호별 정답 인식·검수</span>
            </div>
            <div>
              <strong>문제·정답·해설</strong>
              <span>세 원본을 역할별로 각각 보관</span>
            </div>
          </div>

          <FileUploadZone
            titleLabel={showSeparateFiles ? "문제 파일" : `${sourceLabel} 자료`}
            hintText="모든 안전한 원본 형식 · 실행·스크립트 제외 · 50MB 이하"
            selectedFile={selectedFile}
            onFilesSelect={handleFilesSelect}
            onClearFile={() => {
              setSelectedFile(null);
              reset();
            }}
            disabled={isBusy}
          />

          <Button
            intent="ghost"
            size="sm"
            className={styles.pairToggle}
            aria-expanded={showSeparateFiles}
            onClick={() => {
              setShowSeparateFiles((current) => {
                if (current) {
                  setAnswerFile(null);
                  setExplanationFile(null);
                }
                return !current;
              });
            }}
            disabled={isBusy}
          >
            {showSeparateFiles ? "한 파일로 올리기" : "정답지·해설지가 따로 있어요"}
          </Button>

          {showSeparateFiles && (
            <div className={styles.separateFiles}>
              <div className={styles.pairGuide}>
                <strong>파일 역할을 먼저 정하고 문항 번호로 연결합니다</strong>
                <p>정답과 해설은 선택입니다. 인식하지 못한 번호도 실패로 숨기지 않고 원본과 함께 검수 화면에 표시합니다.</p>
              </div>
              <FileUploadZone
                titleLabel="정답지 파일 (선택)"
                hintText="PDF·이미지는 자동 인식 · 그 밖의 안전한 원본도 보존 · 50MB 이하"
                selectedFile={answerFile}
                onFilesSelect={(files) => setAnswerFile(files[0] ?? null)}
                onClearFile={() => setAnswerFile(null)}
                disabled={isBusy}
              />
              <FileUploadZone
                titleLabel="선생님 해설지 파일 (선택)"
                hintText="PDF·이미지·HWP·HWPX 자동 인식 · 원문·수식·손글씨 원본 보존 · 50MB 이하"
                selectedFile={explanationFile}
                onFilesSelect={(files) => setExplanationFile(files[0] ?? null)}
                onClearFile={() => setExplanationFile(null)}
                disabled={isBusy}
              />
            </div>
          )}

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
                {isConversionRequired && (
                  <svg className="w-4 h-4 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
                  </svg>
                )}
                <span className={`text-sm font-medium ${
                  isDone ? "text-[var(--color-success)]" :
                  isFailed ? "text-[var(--color-error)]" :
                  isConversionRequired ? "text-[var(--color-warning)]" :
                  "text-[var(--color-text-primary)]"
                }`}>
                  {statusLabel}
                </span>
              </div>

              {/* 프로그레스 바 (처리 중일 때) */}
              {isBusy && (
                <div className="mt-2">
                  <progress className={styles.progress} value={progressValue} max={100}>
                    {progressValue}%
                  </progress>
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

              {isConversionRequired && (
                <div className={styles.conversionGuide} role="status">
                  <strong>원본은 보관했습니다.</strong>
                  <p>{result?.message || "자동 분리가 완전하지 않으면 시험 상세에서 문항과 해설을 직접 등록해 검수할 수 있습니다. PDF 재업로드는 필수가 아닙니다."}</p>
                </div>
              )}

              {/* 성공 결과 */}
              {isDone && result && (
                <div className="mt-2 text-xs text-[var(--color-text-muted)] space-y-0.5">
                  <p>인식된 문항 수: <strong className="text-[var(--color-text-primary)]">{result.totalQuestions}개</strong></p>
                  {answerFile && (
                    <p>인식된 정답: <strong className="text-[var(--color-text-primary)]">{result.answerCount}개</strong></p>
                  )}
                  {result.explanationCount > 0 && (
                    <p>인식된 해설: <strong className="text-[var(--color-text-primary)]">{result.explanationCount}개</strong></p>
                  )}
                  {result.pageCount > 1 && (
                    <p>페이지 수: {result.pageCount}페이지</p>
                  )}
                  <p className="mt-1 text-[var(--color-text-tertiary)]">
                    {sourceLabel} 자료에서 문제·정답·원본 해설의 번호를 확인한 뒤 확정해 주세요.
                  </p>
                  {result.pairedSourceStatus === "partial" && (
                    <div className={styles.partialResult} role="alert">
                      <strong>일부 항목은 직접 확인이 필요합니다.</strong>
                      {result.missingAnswerNumbers.length > 0 && (
                        <p>정답 미인식: {result.missingAnswerNumbers.join(", ")}번</p>
                      )}
                      {result.missingExplanationNumbers.length > 0 && (
                        <p>해설 미인식: {result.missingExplanationNumbers.join(", ")}번</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 파일만 저장된 경우 (문항 맞춤 전) */}
              {isUploading && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  파일 업로드 후 문항·해설 맞춤이 자동으로 시작됩니다.
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
                    원본 보존 및 번호 인식
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
