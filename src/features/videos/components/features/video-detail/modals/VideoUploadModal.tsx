// PATH: src/features/videos/components/features/video-detail/modals/VideoUploadModal.tsx
// 영상 추가 모달 — students 도메인 기준 모달 SSOT (AdminModal + ModalHeader/Body/Footer)

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

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
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import "./VideoUploadModal.css";

type Props = {
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
};

type UploadInitResponse = {
  video: { id: number };
  upload_url: string;
  file_key: string;
  content_type?: string;
};

export default function VideoUploadModal({ sessionId, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [showWatermark, setShowWatermark] = useState(true);
  const [allowSkip, setAllowSkip] = useState(false);
  const [maxSpeed, setMaxSpeed] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setFile(null);
    setShowWatermark(true);
    setAllowSkip(false);
    setMaxSpeed(1);
  }, [isOpen]);

  const canSubmit = useMemo(() => {
    return Number.isFinite(sessionId) && sessionId > 0 && !!file && title.trim().length > 0;
  }, [sessionId, file, title]);

  const uploadMut = useMutation({
    mutationFn: async (tempId: string) => {
      if (!file) throw new Error("파일이 없습니다.");

      const initPayload = {
        session: sessionId,
        title: title.trim(),
        filename: file.name,
        content_type: file.type || "video/mp4",
        show_watermark: showWatermark,
        allow_skip: allowSkip,
        max_speed: maxSpeed,
        ...(description.trim() ? { description: description.trim() } : {}),
      };

      const initRes = await api.post<UploadInitResponse>(
        "/media/videos/upload/init/",
        initPayload
      );
      asyncStatusStore.updateProgress(tempId, 15);

      const uploadUrl = initRes.data?.upload_url;
      const videoId = initRes.data?.video?.id;
      const contentTypeFromServer = initRes.data?.content_type;

      if (!uploadUrl || !videoId) {
        throw new Error("업로드 초기화에 실패했습니다.");
      }

      const putHeaders: Record<string, string> = {};
      if (contentTypeFromServer) {
        putHeaders["Content-Type"] = contentTypeFromServer;
      }

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: putHeaders,
      });
      asyncStatusStore.updateProgress(tempId, 50);

      if (!putRes.ok) {
        throw new Error(`R2 업로드 실패: ${putRes.status} ${putRes.statusText}`);
      }

      const completeRes = await api.post<{ id: number }>(
        `/media/videos/${videoId}/upload/complete/`,
        { ok: true }
      );
      asyncStatusStore.updateProgress(tempId, 80);

      return { id: completeRes.data?.id ?? videoId, tempId };
    },

    onSuccess: (data) => {
      if (data?.id != null && data?.tempId) {
        asyncStatusStore.attachWorkerMeta(data.tempId, String(data.id), "video_processing");
      }
      feedback.success("작업이 우하단 작업 박스에서 진행됩니다.");
      onClose();
    },

    onError: (e: unknown, tempId: string) => {
      const msg =
        (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (e as Error)?.message ||
        "업로드에 실패했습니다.";
      asyncStatusStore.completeTask(tempId, "error", msg);
      feedback.error(msg);
    },
  });

  if (!isOpen) return null;

  const pickFile = () => fileInputRef.current?.click();

  const handleUpload = () => {
    const tempId = `video-upload-${sessionId}-${Date.now()}`;
    asyncStatusStore.addTask("영상 추가", tempId);
    uploadMut.mutate(tempId);
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

          {/* 파일 — 드롭존만, 영역 안 문구로 안내 */}
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
              aria-label="동영상 파일 선택"
            >
              {file ? (
                <span className="video-upload-modal__filename">{file.name}</span>
              ) : (
                <span className="video-upload-modal__prompt">파일: 클릭해서 업로드 (mp4 등)</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
            제목과 파일 입력 후 업로드하면 우하단 작업에서 진행 상황을 확인할 수 있습니다.
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={uploadMut.isPending}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={handleUpload}
              disabled={!canSubmit || uploadMut.isPending}
              loading={uploadMut.isPending}
            >
              {uploadMut.isPending ? "업로드 중…" : "업로드"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
