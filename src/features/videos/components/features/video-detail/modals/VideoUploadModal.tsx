// PATH: src/features/videos/components/features/video-detail/modals/VideoUploadModal.tsx
// 영상 추가 모달 — students 도메인 기준 모달 SSOT (AdminModal + ModalHeader/Body/Footer)

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
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
    mutationFn: async () => {
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

      if (!putRes.ok) {
        throw new Error(`R2 업로드 실패: ${putRes.status} ${putRes.statusText}`);
      }

      const completeRes = await api.post(
        `/media/videos/${videoId}/upload/complete/`,
        { ok: true }
      );

      return completeRes.data;
    },

    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["session-videos", sessionId],
      });
    },

    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (e as Error)?.message ||
        "업로드에 실패했습니다.";
      feedback.error(msg);
    },
  });

  if (!isOpen) return null;

  const pickFile = () => fileInputRef.current?.click();

  const handleUpload = () => {
    uploadMut.mutate();
    onClose();
  };

  return (
    <AdminModal open={isOpen} onClose={onClose} type="action" width={MODAL_WIDTH.md}>
      <ModalHeader
        type="action"
        title="영상 추가"
        description="파일 업로드 및 재생 정책을 설정합니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          {/* 제목 */}
          <div className="modal-form-group">
            <span className="modal-section-label">제목</span>
            <input
              className="ds-input"
              placeholder="예: 1강 OT"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* 파일 업로드 */}
          <div className="modal-form-group">
            <span className="modal-section-label">파일 업로드</span>
            <div
              className="video-upload-modal__dropzone"
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
                <div className="video-upload-modal__dropzone-inner">
                  <span className="video-upload-modal__filename">{file.name}</span>
                  <span className="modal-hint modal-hint--block" style={{ marginTop: 4 }}>
                    클릭해서 파일 변경
                  </span>
                </div>
              ) : (
                <div className="video-upload-modal__dropzone-inner">
                  <span className="video-upload-modal__prompt">여기를 클릭해서 업로드</span>
                  <span className="modal-hint modal-hint--block" style={{ marginTop: 4 }}>
                    mp4 등 동영상 파일
                  </span>
                </div>
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

          {/* 영상 설명 */}
          <div className="modal-form-group modal-form-group--neutral">
            <span className="modal-section-label">영상 설명</span>
            <textarea
              className="ds-textarea"
              rows={3}
              placeholder="(선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 재생 정책 */}
          <div className="modal-form-group modal-form-group--neutral">
            <span className="modal-section-label">재생 정책</span>
            <div className="modal-form-row modal-form-row--1-auto" style={{ flexWrap: "wrap", gap: "var(--space-4)" }}>
              <label className="modal-actions-inline" style={{ cursor: "pointer", alignItems: "center" }}>
                <span className="modal-hint" style={{ marginBottom: 0 }}>워터마크</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showWatermark}
                  onClick={() => setShowWatermark((v) => !v)}
                  className="video-upload-modal__toggle"
                >
                  <span
                    className="video-upload-modal__toggle-thumb"
                    data-on={showWatermark}
                  />
                </button>
              </label>
              <label className="modal-actions-inline" style={{ cursor: "pointer", alignItems: "center" }}>
                <span className="modal-hint" style={{ marginBottom: 0 }}>건너뛰기</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowSkip}
                  onClick={() => setAllowSkip((v) => !v)}
                  className="video-upload-modal__toggle"
                >
                  <span
                    className="video-upload-modal__toggle-thumb"
                    data-on={allowSkip}
                  />
                </button>
              </label>
              <label className="modal-actions-inline" style={{ alignItems: "center", gap: "var(--space-2)" }}>
                <span className="modal-hint" style={{ marginBottom: 0 }}>최대 배속</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={0.25}
                  className="ds-input"
                  style={{ width: 72 }}
                  value={maxSpeed}
                  onChange={(e) => setMaxSpeed(Number(e.target.value))}
                />
              </label>
            </div>
            <span className="modal-hint modal-hint--block" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>
              session_id: {sessionId}
            </span>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span className="modal-hint" style={{ marginBottom: 0 }}>
            제목과 파일을 입력한 뒤 업로드하세요.
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
