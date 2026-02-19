// PATH: src/features/videos/components/features/video-detail/modals/VideoUploadModal.tsx
// 영상 추가 모달 — students 도메인 기준 모달 SSOT (AdminModal + ModalHeader/Body/Footer)

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { uploadVideo } from "@/features/videos/utils/videoUpload";
import "./VideoUploadModal.css";

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

type Props = {
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
};


export default function VideoUploadModal({ sessionId, isOpen, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [showWatermark, setShowWatermark] = useState(true);
  const [allowSkip, setAllowSkip] = useState(false);
  const [maxSpeed, setMaxSpeed] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setFiles([]);
    setShowWatermark(true);
    setAllowSkip(false);
    setMaxSpeed(1);
    setIsUploading(false);
  }, [isOpen]);

  const canSubmit = useMemo(() => {
    return Number.isFinite(sessionId) && sessionId > 0 && files.length > 0 && title.trim().length > 0;
  }, [sessionId, files.length, title]);

  if (!isOpen) return null;

  const pickFile = () => fileInputRef.current?.click();

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);

    // 모달은 바로 닫고, 업로드는 백그라운드에서 실행
    onClose();

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileTitle = i === 0 ? title.trim() : `${title.trim()} (${i + 1})`;

      try {
        await uploadVideo({
          sessionId,
          file,
          title: fileTitle,
          description,
          showWatermark,
          allowSkip,
          maxSpeed,
        });
        successCount += 1;
      } catch (error) {
        const msg =
          (error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
            ?.detail ||
          (error as Error)?.message ||
          "업로드에 실패했습니다.";
        errors.push(`${file.name}: ${msg}`);
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      feedback.success(
        errors.length > 0
          ? `${successCount}개 업로드 완료. ${errors.length}개 실패. 인코딩은 우하단 작업 박스에서 확인하세요.`
          : `${successCount}개 업로드 완료. 인코딩은 우하단 작업 박스에서 이어서 진행됩니다.`
      );
    }
    if (errors.length > 0) {
      errors.forEach((e) => feedback.error(e));
    }
  };

  return (
    <AdminModal open={isOpen} onClose={onClose} type="action" width={MODAL_WIDTH.md}>
      <ModalHeader
        type="action"
        title="영상 추가"
        description="파일 업로드 및 재생 정책을 설정합니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact video-upload-modal__body">
          {/* 제목 — 인풋만, placeholder로 안내 */}
          <div className="modal-form-group video-upload-modal__row video-upload-modal__row--input-only">
            <input
              className="ds-input"
              placeholder="제목 (예: 1강 OT)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* 파일 — 드롭존만, 다중 선택 가능 */}
          <div className="modal-form-group video-upload-modal__row video-upload-modal__row--input-only">
            <div
              className="video-upload-modal__dropzone video-upload-modal__dropzone--compact"
              onClick={pickFile}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pickFile();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const items = e.dataTransfer?.files;
                if (items?.length) {
                  setFiles((prev) => [...prev, ...Array.from(items)].filter((f) => f.type.startsWith("video/")));
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              aria-label="동영상 파일 선택 (다중 선택 가능)"
            >
              {files.length > 0 ? (
                <span className="video-upload-modal__filename">
                  {files.length === 1
                    ? files[0].name
                    : `${files.length}개 파일 선택됨: ${files.map((f) => f.name).join(", ")}`}
                </span>
              ) : (
                <span className="video-upload-modal__prompt">파일: 클릭 또는 드래그하여 업로드 (mp4 등, 다중 선택 가능)</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="video/*"
              multiple
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                setFiles((prev) => (list.length > 0 ? [...prev, ...list] : prev));
                e.target.value = "";
              }}
            />
          </div>

          {/* 설명 — textarea만, placeholder로 안내, 크기·위치 고정 */}
          <div className="modal-form-group modal-form-group--neutral video-upload-modal__row video-upload-modal__row--input-only video-upload-modal__desc-wrap">
            <textarea
              className="ds-textarea video-upload-modal__desc"
              placeholder="설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* 재생 정책 — 워터마크 · 건너뛰기 · 배속 가로 1줄, 배속은 올림/내림 버튼 밖으로 */}
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
            업로드 버튼을 누르면 우하단 작업 박스에서 업로드·인코딩 진행 상황을 확인할 수 있습니다.
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
              {isUploading ? "업로드 중…" : "업로드"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
