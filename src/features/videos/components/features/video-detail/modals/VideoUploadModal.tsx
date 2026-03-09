// PATH: src/features/videos/components/features/video-detail/modals/VideoUploadModal.tsx
// 영상 추가 모달 — 강의·차시·영상. 5개 슬롯 가로 배치, 엑셀 업로드 존 디자인·감성 동일, 병렬 업로드 및 제목 - 1 ~ - 5 자동 부여

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { initVideoUpload, uploadFileToR2AndComplete } from "@/features/videos/utils/videoUpload";
import "./VideoUploadModal.css";

function UploadIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckCircleIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden
      style={{ color: "var(--color-status-success, #10b981)" }}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const SLOT_COUNT = 5;
const VIDEO_ACCEPT = "video/*";

type Props = {
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
};

export default function VideoUploadModal({ sessionId, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [baseTitle, setBaseTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<(File | null)[]>(() => Array(SLOT_COUNT).fill(null));
  const [dragoverIndex, setDragoverIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showWatermark, setShowWatermark] = useState(true);
  const [allowSkip, setAllowSkip] = useState(false);
  const [maxSpeed, setMaxSpeed] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;
    setBaseTitle("");
    setDescription("");
    setFiles(Array(SLOT_COUNT).fill(null));
    setDragoverIndex(null);
    setShowWatermark(true);
    setAllowSkip(false);
    setMaxSpeed(1);
    setIsUploading(false);
  }, [isOpen]);

  const filledCount = useMemo(() => files.filter(Boolean).length, [files]);
  const canSubmit = useMemo(
    () => Number.isFinite(sessionId) && sessionId > 0 && filledCount > 0 && baseTitle.trim().length > 0,
    [sessionId, filledCount, baseTitle]
  );

  const setFileAt = useCallback((index: number, file: File | null) => {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }, []);

  const pickFile = useCallback((index: number) => {
    inputRefs.current[index]?.click();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDragoverIndex(null);
      if (isUploading) return;
      const list = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
      const video = list.find((f) => f.type.startsWith("video/"));
      if (video) setFileAt(index, video);
    },
    [isUploading, setFileAt]
  );

  const handleFileChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files ? Array.from(e.target.files) : [];
      const video = list.find((f) => f.type.startsWith("video/"));
      setFileAt(index, video || null);
      e.target.value = "";
    },
    [setFileAt]
  );

  const handleUpload = async () => {
    const items: { file: File; title: string }[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const file = files[i];
      if (!file) continue;
      items.push({ file, title: `${baseTitle.trim()} - ${i + 1}` });
    }
    if (items.length === 0) return;

    setIsUploading(true);
    const initResults: { init: Awaited<ReturnType<typeof initVideoUpload>>; file: File }[] = [];
    const initErrors: string[] = [];

    try {
      for (const { file, title } of items) {
        try {
          const init = await initVideoUpload({
            sessionId,
            file,
            title,
            description,
            showWatermark,
            allowSkip,
            maxSpeed,
          });
          initResults.push({ init, file });
        } catch (error) {
          const err = error as { response?: { status?: number; data?: { detail?: string } }; message?: string };
          const msg =
            err?.response?.data?.detail ||
            err?.message ||
            "업로드에 실패했습니다.";
          if (err?.response?.status === 403 && !err?.response?.data?.detail) {
            initErrors.push(`${file.name}: 권한이 없습니다.`);
          } else {
            initErrors.push(`${file.name}: ${msg}`);
          }
        }
      }

      if (initResults.length > 0) {
        qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
      }
      onClose();

      if (initErrors.length > 0) {
        feedback.error(initErrors.join(" / "));
      }

      const results = await Promise.allSettled(
        initResults.map(({ init, file }) => uploadFileToR2AndComplete(init, file))
      );
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const r2Errors: string[] = [];
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          r2Errors.push(`${initResults[idx].file.name}: ${(r.reason as Error)?.message || "업로드 실패"}`);
        }
      });

      if (successCount > 0) {
        feedback.success(
          r2Errors.length > 0
            ? `${successCount}개 업로드 완료. ${r2Errors.length}개 실패. 우하단 진행 상황에서 확인하세요.`
            : `${successCount}개 업로드 완료. 처리는 우하단에서 이어서 진행됩니다.`
        );
        qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
      }
      if (r2Errors.length > 0) {
        feedback.error(r2Errors.join(" / "));
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AdminModal open={isOpen} onClose={onClose} type="action" width={MODAL_WIDTH.lg} onEnterConfirm={canSubmit && !isUploading ? handleUpload : undefined}>
      <ModalHeader
        type="action"
        title="영상 추가"
        description="파일 업로드 및 재생 정책을 설정합니다. 최대 5개까지 동시 업로드 가능합니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact video-upload-modal__body">
          {/* 제목 — 슬롯별로 "제목 - 1", "제목 - 2" … 자동 부여 */}
          <div className="modal-form-group video-upload-modal__row video-upload-modal__row--input-only">
            <input
              className="ds-input"
              placeholder="제목 (예: 언남고 1학기 중간 과학 1강) — 아래 슬롯 순서대로 - 1, - 2, … 가 붙습니다"
              value={baseTitle}
              onChange={(e) => setBaseTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* 5개 가로 슬롯 — 엑셀 업로드 존과 동일 디자인(modal.css .excel-upload-zone) */}
          <div className="modal-form-group video-upload-modal__row">
            <span className="modal-section-label video-upload-modal__slots-label">
              파일: 클릭 또는 드래그 (mp4 등, 슬롯당 1개, 최대 5개)
            </span>
            <div className="video-upload-modal__slots">
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <div key={i} className="video-upload-modal__slot">
                  <div
                    role="button"
                    tabIndex={0}
                    className={`excel-upload-zone video-upload-modal__zone ${files[i] ? "excel-upload-zone--filled" : ""} ${dragoverIndex === i ? "excel-upload-zone--dragover" : ""}`}
                    onClick={() => {
                      if (files[i]) return;
                      if (!isUploading) pickFile(i);
                    }}
                    onKeyDown={(e) => {
                      if (files[i]) return;
                      if ((e.key === "Enter" || e.key === " ") && !isUploading) {
                        e.preventDefault();
                        pickFile(i);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isUploading && !files[i]) setDragoverIndex(i);
                    }}
                    onDragLeave={() => setDragoverIndex(null)}
                    onDrop={(e) => handleDrop(e, i)}
                    aria-label={`영상 ${i + 1} 슬롯`}
                  >
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="file"
                      accept={VIDEO_ACCEPT}
                      className="hidden"
                      onChange={(e) => handleFileChange(i, e)}
                    />
                    {files[i] ? (
                      <div className="excel-upload-zone__filled">
                        <CheckCircleIcon size={36} />
                        <span className="excel-upload-zone__filled-filename">{files[i]!.name}</span>
                        <button
                          type="button"
                          className="excel-upload-zone__filled-clear"
                          onClick={(e) => { e.stopPropagation(); setFileAt(i, null); }}
                          disabled={isUploading}
                        >
                          파일 변경
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="excel-upload-zone__head">
                          <UploadIcon size={18} />
                          <span className="excel-upload-zone__title">Video</span>
                        </div>
                        <div className="excel-upload-zone__drag-label">Drag or Click</div>
                        <div className="excel-upload-zone__upload">
                          <UploadIcon size={14} />
                          <span className="excel-upload-zone__upload-label">업로드</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="video-upload-modal__slot-title" title={baseTitle.trim() ? `${baseTitle.trim()} - ${i + 1}` : undefined}>
                    {baseTitle.trim() ? `${baseTitle.trim()} - ${i + 1}` : `— ${i + 1} —`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div className="modal-form-group modal-form-group--neutral video-upload-modal__row video-upload-modal__row--input-only video-upload-modal__desc-wrap">
            <textarea
              className="ds-textarea video-upload-modal__desc"
              placeholder="설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* 재생 정책 */}
          <div className="modal-form-group modal-form-group--neutral video-upload-modal__row">
            <div className="video-upload-modal__policy-row">
              <label className="video-upload-modal__policy-item">
                <span className="video-upload-modal__policy-label">워터마크</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showWatermark}
                  onClick={() => setShowWatermark((v) => !v)}
                  className="video-upload-modal__toggle"
                >
                  <span className="video-upload-modal__toggle-thumb" data-on={showWatermark} />
                </button>
              </label>
              <label className="video-upload-modal__policy-item">
                <span className="video-upload-modal__policy-label">건너뛰기</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowSkip}
                  onClick={() => setAllowSkip((v) => !v)}
                  className="video-upload-modal__toggle"
                >
                  <span className="video-upload-modal__toggle-thumb" data-on={allowSkip} />
                </button>
              </label>
              <div className="video-upload-modal__policy-item video-upload-modal__speed-wrap">
                <span className="video-upload-modal__policy-label">배속</span>
                <div className="video-upload-modal__speed-stepper" role="group" aria-label="최대 배속">
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    iconOnly
                    leftIcon={<ChevronLeftIcon />}
                    onClick={() => setMaxSpeed((v) => Math.max(1, v - 0.25))}
                    disabled={maxSpeed <= 1}
                    aria-label="배속 낮추기"
                  />
                  <span className="video-upload-modal__speed-value">
                    {maxSpeed % 1 === 0 ? `${maxSpeed}x` : `${maxSpeed.toFixed(2)}x`}
                  </span>
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    iconOnly
                    leftIcon={<ChevronRightIcon />}
                    onClick={() => setMaxSpeed((v) => Math.min(5, v + 0.25))}
                    disabled={maxSpeed >= 5}
                    aria-label="배속 높이기"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span className="modal-hint" style={{ marginBottom: 0 }}>
            업로드 버튼을 누르면 우하단 진행 상황에서 업로드·처리 진행을 확인할 수 있습니다.
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={isUploading}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={handleUpload}
              disabled={!canSubmit || isUploading}
              loading={isUploading}
            >
              {isUploading ? "업로드 중…" : `업로드 (${filledCount}개)`}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
