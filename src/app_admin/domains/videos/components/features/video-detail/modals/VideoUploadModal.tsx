// PATH: src/app_admin/domains/videos/components/features/video-detail/modals/VideoUploadModal.tsx
// 영상 추가 모달 — 다건 파일 큐에서 제목과 재생 순서를 확정한 뒤 업로드

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { originalDurationSeconds } from "@/shared/media/video/reviewDuration";
import ReviewLimitOption from "@/shared/media/video/ReviewLimitOption";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileVideo2,
  GripVertical,
  Link2,
  SquarePlay as Youtube,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { extractApiError } from "@/shared/utils/extractApiError";
import { feedback } from "@/shared/ui/feedback/feedback";
import { initVideoUpload, runWithVideoUploadGuard, uploadFileToR2AndComplete, videoContentType, videoFileAccept, type InitVideoResult } from "@admin/domains/videos/utils/videoUpload";
import { captureVideoUploadConfig } from "@/shared/api/videoUploadCompletion";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";
import { adminVideoQueryKeys } from "@admin/domains/videos/queryKeys";
import { createYoutubeVideo } from "@admin/domains/videos/api/videos.api";
import { extractYouTubeVideoId, youtubeThumbnailUrl } from "@/shared/media/video/youtube";
import "./VideoUploadModal.css";

type UploadMode = "file" | "youtube";
type UploadItem = {
  id: string;
  file: File;
  title: string;
  reviewLimit: boolean;
  init?: InitVideoResult;
};
type Props = {
  sessionId: number;
  folderId?: number | null;
  isOpen: boolean;
  onClose: () => void;
};

function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^./\\]+$/, "").trim();
  return withoutExtension || filename.trim() || "영상";
}



export default function VideoUploadModal({ sessionId, folderId = null, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextItemIdRef = useRef(0);
  const mountedRef = useRef(true);
  const uploadLock = useRef(false);

  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [baseTitle, setBaseTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [excludedNames, setExcludedNames] = useState<string[]>([]);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [originalLength, setOriginalLength] = useState("");
  const [youtubeLimit, setYoutubeLimit] = useState(false);
  const originalDuration = originalDurationSeconds(originalLength);
  const [isUploading, setIsUploading] = useState(false);

  const [showWatermark, setShowWatermark] = useState(true);
  const [allowSkip, setAllowSkip] = useState(false);
  const [maxSpeed, setMaxSpeed] = useState<number>(1);

  // 직전 init 시도에서 실패한 파일 사유. 모달 내 띠 형태로 노출 + "다시 시도" 버튼.
  const [initErrorMessages, setInitErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setUploadMode("file");
    setBaseTitle("");
    setDescription("");
    setUploadItems([]);
    setExcludedNames([]);
    setIsFileDragOver(false);
    setDraggedItemIndex(null);
    setYoutubeUrl("");
    setOriginalLength("");
    setYoutubeLimit(false);
    setShowWatermark(true);
    setAllowSkip(false);
    setMaxSpeed(1);
    setIsUploading(false);
    setInitErrorMessages([]);
  }, [isOpen]);

  const filledCount = uploadItems.length;
  const youtubeVideoId = useMemo(() => extractYouTubeVideoId(youtubeUrl), [youtubeUrl]);
  const canSubmit = useMemo(
    () => {
      if (!Number.isFinite(sessionId) || sessionId <= 0) return false;
      if (uploadMode === "youtube") return baseTitle.trim().length > 0 && !!youtubeVideoId &&
        (!youtubeLimit || originalDuration !== null);
      return uploadItems.length > 0 && uploadItems.every((item) => item.title.trim().length > 0);
    },
    [sessionId, baseTitle, uploadItems, uploadMode, youtubeVideoId, youtubeLimit, originalDuration]
  );

  const addFiles = useCallback((files: File[]) => {
    const videos = files.filter(file => videoContentType(file));
    setExcludedNames(files.filter(file => !videoContentType(file)).map(file => file.name));
    if (!videos.length) return;
    setUploadItems((prev) => [
      ...prev,
      ...videos.map((file) => ({
        id: `video-upload-item-${nextItemIdRef.current++}`,
        file,
        title: titleFromFilename(file.name),
        reviewLimit: false,
      })),
    ]);
  }, []);

  const updateItemTitle = useCallback((id: string, title: string) => {
    setUploadItems((prev) => prev.map((item) => (item.id === id ? { ...item, title } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setUploadItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const moveItem = useCallback((from: number, to: number) => {
    setUploadItems((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);
    if (isUploading) return;
    addFiles(e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []);
  }, [addFiles, isUploading]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files ? Array.from(e.target.files) : []);
    e.target.value = "";
  }, [addFiles]);

  const handleUpload = useCallback(async () => {
    setInitErrorMessages([]);

    const items = uploadItems.map((item) => ({ ...item, title: item.title.trim() }));
    if (items.length === 0 || uploadLock.current) return;
    uploadLock.current = true;

    setIsUploading(true);

    try {
      await runWithVideoUploadGuard(async () => {
        const config = captureVideoUploadConfig();
        const errors: string[] = [];
        const failed = new Map<string, InitVideoResult>();
        const completed = new Set<string>();
        const active = new Set<Promise<void>>();
        const key = adminVideoQueryKeys.sessionVideosScoped(sessionId);
        let notified = false;
        for (const item of items) {
          // Wait for transfer capacity before reserving a row and a signed URL.
          // Serial init also preserves the requested playback order.
          if (active.size >= 2) await Promise.race(active);
          let init: InitVideoResult;
          try {
            init = item.init ?? await initVideoUpload({
              sessionId, file: item.file, title: item.title, reviewLimit: item.reviewLimit,
              description, folderId, showWatermark, allowSkip, maxSpeed,
            }, config);
          } catch (error) {
            errors.push(`${item.file.name} · 등록 실패 · ${extractApiError(error, "영상을 등록할 수 없습니다.")}`);
            continue;
          }
          if (!notified) {
            notified = true;
            void qc.invalidateQueries({ queryKey: key });
          }
          const transfer = uploadFileToR2AndComplete(init, item.file, Boolean(item.init)).then(() => {
            completed.add(item.id);
            if (mountedRef.current) setUploadItems(prev => prev.filter(row => row.id !== item.id));
          }, error => {
            failed.set(item.id, init);
            const stage = init.completion ? "완료 확인 실패" : "파일 전송 실패";
            errors.push(`${item.file.name} · ${stage} · ${extractApiError(error, "다시 시도해 주세요.")}`);
          }).finally(() => { active.delete(transfer); });
          active.add(transfer);
        }
        await Promise.all(active);
        if (completed.size) {
          feedback.success(`${completed.size}개 영상 업로드 완료. 인코딩 진행 상황은 작업박스에서 확인할 수 있습니다.`);
          void qc.invalidateQueries({ queryKey: key });
        }
        if (errors.length) feedback.error(errors.join(" / "));
        if (!mountedRef.current) return;
        setUploadItems(prev => prev.map(item => ({
          ...item, init: failed.get(item.id) ?? item.init,
        })));
        setInitErrorMessages(errors);
        if (!errors.length) onClose();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "업로드를 시작하지 못했습니다.";
      setInitErrorMessages([message]);
      feedback.error(message);
    } finally {
      uploadLock.current = false;
      if (mountedRef.current) {
        setIsUploading(false);
      }
    }
  }, [
    allowSkip,
    description,
    folderId,
    maxSpeed,
    onClose,
    qc,
    sessionId,
    showWatermark,
    uploadItems,
  ]);

  const handleYoutubeCreate = useCallback(async () => {
    setInitErrorMessages([]);
    const title = baseTitle.trim();
    const url = youtubeUrl.trim();
    const videoId = extractYouTubeVideoId(url);
    if (!title || !videoId) {
      feedback.error("YouTube 링크와 제목을 확인해 주세요.");
      return;
    }

    setIsUploading(true);
    try {
      await createYoutubeVideo({
        session: sessionId,
        title,
        url,
        review_watch_limit_enabled: youtubeLimit,
        ...(youtubeLimit && originalDuration !== null ? { duration: originalDuration } : {}),
        ...(folderId ? { folder: folderId } : {}),
        show_watermark: showWatermark,
        allow_skip: allowSkip,
        max_speed: maxSpeed,
      });
      feedback.success("YouTube 링크 영상을 추가했습니다.");
      qc.invalidateQueries({ queryKey: adminVideoQueryKeys.sessionVideosScoped(sessionId) });
      onClose();
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string; code?: string } }; message?: string };

      feedback.error(err?.response?.data?.detail || err?.message || "YouTube 링크 추가에 실패했습니다.");
    } finally {
      if (mountedRef.current) {
        setIsUploading(false);
      }
    }
  }, [
    allowSkip,
    baseTitle,
    folderId,
    maxSpeed,
    onClose,
    qc,
    sessionId,
    showWatermark,
    originalDuration,
    youtubeLimit,
    youtubeUrl,
  ]);

  const handleSubmit = useCallback(() => {
    if (uploadMode === "youtube") {
      void handleYoutubeCreate();
      return;
    }
    void handleUpload();
  }, [uploadMode, handleUpload, handleYoutubeCreate]);

  const handleClose = useCallback(() => {
    if (isUploading) {
      feedback.info(uploadMode === "youtube" ? "링크 추가가 진행 중입니다." : "업로드는 작업박스에서 계속 진행됩니다.");
    }
    onClose();
  }, [isUploading, onClose, uploadMode]);

  if (!isOpen) return null;

  return (
    <AdminModal open={isOpen} onClose={handleClose} type="action" width={MODAL_WIDTH.wide} onEnterConfirm={canSubmit && !isUploading ? handleSubmit : undefined}>
      <ModalHeader
        type="action"
        title="영상 추가"
        description={uploadMode === "youtube" ? "YouTube 링크와 재생 정책을 설정합니다." : "여러 영상을 한 번에 고르고 제목과 재생 순서를 확인합니다."}
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact video-upload-modal__body">
          <div className="video-upload-modal__mode-tabs" role="tablist" aria-label="영상 추가 방식">
            <button
              type="button"
              role="tab"
              aria-selected={uploadMode === "file"}
              className="video-upload-modal__mode-tab"
              onClick={() => setUploadMode("file")}
              disabled={isUploading}
            >
              <UploadIcon size={16} aria-hidden />
              <span>파일 업로드</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={uploadMode === "youtube"}
              className="video-upload-modal__mode-tab"
              onClick={() => setUploadMode("youtube")}
              disabled={isUploading}
            >
              <Youtube size={17} aria-hidden />
              <span>YouTube 링크</span>
            </button>
          </div>

          {excludedNames.length > 0 && <p className="video-upload-modal__error-banner" role="alert">
            영상 형식을 확인할 수 없어 제외한 파일 · {excludedNames.join(", ")}
          </p>}
          {/* 직전 시도에서 실패한 파일 사유 — 제목과 순서를 보존한 채 다시 시도 가능 */}
          {uploadMode === "file" && initErrorMessages.length > 0 && (
            <div
              role="alert"
              className="video-upload-modal__error-banner"
            >
              <div className="video-upload-modal__error-title">
                일부 파일이 실패했습니다 — 목록에 그대로 남아있어요. 사유를 확인하고 ‘다시 시도’를 눌러 주세요.
              </div>
              <ul className="video-upload-modal__error-list">
                {initErrorMessages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {uploadMode === "file" ? (
            <div className="modal-form-group video-upload-modal__row video-upload-modal__file-panel">
              <div
                role="button"
                tabIndex={0}
                aria-label="영상 파일 추가"
                className={`video-upload-modal__drop-zone ${isFileDragOver ? "video-upload-modal__drop-zone--active" : ""}`}
                onClick={() => {
                  if (!isUploading) inputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isUploading) {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (!isUploading) setIsFileDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isUploading) setIsFileDragOver(true);
                }}
                onDragLeave={(e) => {
                  const relatedTarget = e.relatedTarget;
                  if (!(relatedTarget instanceof Node) || !e.currentTarget.contains(relatedTarget)) {
                    setIsFileDragOver(false);
                  }
                }}
                onDrop={handleDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={videoFileAccept}
                  multiple
                  className="hidden"
                  data-testid="video-batch-file-input"
                  onChange={handleFileChange}
                />
                <span className="video-upload-modal__drop-icon" aria-hidden>
                  <UploadIcon size={21} />
                </span>
                <span className="video-upload-modal__drop-copy">
                  <strong>영상 파일을 끌어놓거나 클릭해서 선택</strong>
                  <span>파일 탐색기에서 여러 개를 한 번에 선택할 수 있습니다.</span>
                </span>
                <span className="video-upload-modal__drop-action">파일 선택</span>
              </div>

              {uploadItems.length > 0 && (
                <div className="video-upload-modal__queue-wrap">
                  <div className="video-upload-modal__queue-heading">
                    <div>
                      <strong>재생 순서</strong>
                      <span>위에서부터 학생에게 재생됩니다. 제목은 파일명으로 미리 채웠습니다.</span>
                    </div>
                    <span className="video-upload-modal__queue-count">{uploadItems.length}개</span>
                  </div>
                  <ol className="video-upload-modal__queue" aria-label="업로드할 영상 재생 순서">
                    {uploadItems.map((item, index) => (
                      <li
                        key={item.id}
                        className={`video-upload-modal__queue-item ${draggedItemIndex === index ? "video-upload-modal__queue-item--dragging" : ""}`}
                        onDragOver={(e) => {
                          if (draggedItemIndex == null) return;
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          if (draggedItemIndex == null) return;
                          e.preventDefault();
                          moveItem(draggedItemIndex, index);
                          setDraggedItemIndex(null);
                        }}
                      >
                        <span className="video-upload-modal__queue-index" aria-hidden>{index + 1}</span>
                        <div className="video-upload-modal__queue-main">
                          <span className="video-upload-modal__filename" title={item.file.name}>
                            <FileVideo2 size={14} aria-hidden />
                            {item.file.name}
                          </span>
                          <label className="video-upload-modal__title-field">
                            <span className="sr-only">{index + 1}번째 영상 제목</span>
                            <input
                              className="ds-input"
                              aria-label={`${index + 1}번째 영상 제목`}
                              aria-invalid={item.title.trim().length === 0}
                              placeholder={titleFromFilename(item.file.name)}
                              maxLength={255}
                              value={item.title} readOnly={Boolean(item.init)}
                              onChange={(e) => updateItemTitle(item.id, e.target.value)}
                              disabled={isUploading}
                            />
                          </label>
                          <label><input type="checkbox" checked={item.reviewLimit} disabled={isUploading || Boolean(item.init)}
                            aria-label={`${index + 1}번째 영상 복습시간 1.4배 제한`}
                            onChange={event => { const checked = event.target.checked; setUploadItems(prev => prev.map(row => row.id === item.id ? { ...row, reviewLimit: checked } : row)); }} /> 복습시간 1.4배 제한</label>
                        </div>
                        <div className="video-upload-modal__queue-actions" aria-label={`${index + 1}번째 영상 순서와 삭제`}>
                          <button
                            type="button"
                            className="video-upload-modal__grip"
                            draggable={!isUploading}
                            onDragStart={(e) => {
                              setDraggedItemIndex(index);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => setDraggedItemIndex(null)}
                            disabled={isUploading}
                            aria-label={`${index + 1}번째 영상을 끌어서 순서 변경`}
                            title="끌어서 순서 변경"
                          >
                            <GripVertical size={17} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, index - 1)}
                            disabled={isUploading || index === 0}
                            aria-label={`${index + 1}번째 영상을 위로 이동`}
                            title="위로 이동"
                          >
                            <ChevronUp size={16} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, index + 1)}
                            disabled={isUploading || index === uploadItems.length - 1}
                            aria-label={`${index + 1}번째 영상을 아래로 이동`}
                            title="아래로 이동"
                          >
                            <ChevronDown size={16} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="video-upload-modal__remove"
                            onClick={() => removeItem(item.id)}
                            disabled={isUploading}
                            aria-label={`${item.file.name} 제거`}
                            title="목록에서 제거"
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div className="modal-form-group video-upload-modal__row video-upload-modal__youtube-panel">
              <input
                className="ds-input"
                placeholder="제목 (예: 언남고 1학기 중간 과학 1강)"
                maxLength={255}
                value={baseTitle}
                onChange={(e) => setBaseTitle(e.target.value)}
                autoFocus
                disabled={isUploading}
              />
              <div className="video-upload-modal__youtube-input-wrap">
                <Link2 size={16} className="video-upload-modal__youtube-input-icon" aria-hidden />
                <input
                  className="ds-input video-upload-modal__youtube-input"
                  placeholder="https://youtu.be/..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isUploading}
                />
              </div>
              <ReviewLimitOption checked={youtubeLimit} onChange={setYoutubeLimit} disabled={isUploading}
                originalLength={originalLength} onLengthChange={setOriginalLength} />
              {youtubeVideoId ? (
                <div className="video-upload-modal__youtube-preview">
                  <img
                    src={youtubeThumbnailUrl(youtubeVideoId)}
                    alt=""
                    className="video-upload-modal__youtube-thumb"
                    loading="lazy"
                  />
                  <div className="video-upload-modal__youtube-preview-body">
                    <div className="video-upload-modal__youtube-preview-title">
                      YouTube 영상
                    </div>
                    <div className="video-upload-modal__youtube-preview-id">
                      {youtubeVideoId}
                    </div>
                  </div>
                </div>
              ) : youtubeUrl.trim() ? (
                <div className="video-upload-modal__youtube-invalid" role="alert">
                  올바른 YouTube 영상 링크를 입력해 주세요.
                </div>
              ) : null}
            </div>
          )}

          {/* 설명 */}
          {uploadMode === "file" && (
          <div className="modal-form-group modal-form-group--neutral video-upload-modal__row video-upload-modal__row--input-only video-upload-modal__desc-wrap">
            <textarea
              className="ds-textarea video-upload-modal__desc"
              placeholder="설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          )}

          {uploadMode === "file" && <p>복습시간 제한은 파일마다 선택합니다. 선택한 60분 영상은 학생 한 명당 누적 84분까지 복습할 수 있습니다.</p>}
          {/* 재생 정책 */}
          <div className="modal-form-group modal-form-group--neutral video-upload-modal__row">
            <div className="video-upload-modal__policy-row">
              <button
                type="button"
                role="switch"
                aria-checked={showWatermark}
                aria-label={`워터마크 ${showWatermark ? "허용" : "금지"}`}
                onClick={() => setShowWatermark((v) => !v)}
                className="video-upload-modal__policy-item video-upload-modal__policy-toggle"
              >
                <span className="video-upload-modal__policy-label">워터마크</span>
                <span
                  className="video-upload-modal__policy-state"
                  data-on={showWatermark}
                  aria-hidden
                >
                  {showWatermark ? "허용" : "금지"}
                </span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={allowSkip}
                aria-label={`자유 건너뛰기 ${allowSkip ? "허용" : "수강 중 제한"}`}
                onClick={() => setAllowSkip((v) => !v)}
                className="video-upload-modal__policy-item video-upload-modal__policy-toggle"
              >
                <span className="video-upload-modal__policy-label">자유 건너뛰기</span>
                <span
                  className="video-upload-modal__policy-state"
                  data-on={allowSkip}
                  aria-hidden
                >
                  {allowSkip ? "허용" : "수강 중 제한"}
                </span>
              </button>
              <div className="video-upload-modal__policy-item video-upload-modal__speed-wrap">
                <span className="video-upload-modal__policy-label">배속</span>
                <div className="video-upload-modal__speed-stepper" role="group" aria-label="최대 배속">
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    iconOnly
                    leftIcon={<ChevronLeft size={16} strokeWidth={2.5} aria-hidden />}
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
                    leftIcon={<ChevronRight size={16} strokeWidth={2.5} aria-hidden />}
                    onClick={() => setMaxSpeed((v) => Math.min(5, v + 0.25))}
                    disabled={maxSpeed >= 5}
                    aria-label="배속 높이기"
                  />
                </div>
              </div>
            </div>
            <p className="modal-hint video-upload-modal__policy-hint">
              <span className="video-upload-modal__policy-hint-badge" aria-hidden>
                <AttendanceStatusBadge status="ONLINE" variant="2ch" />
              </span>
              {uploadMode === "youtube" ? (
                <>
                  공개 또는 일부공개이며 퍼가기가 허용된 YouTube 영상만 학생앱에서 재생됩니다.
                </>
              ) : (
                <>
                  출결 뱃지가 <strong>영상</strong>인 학생만 최초 1회 적용됩니다. 이후에는 제한 없이 시청할 수 있어요.
                </>
              )}
            </p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span className="modal-hint video-upload-modal__footer-hint">
            {uploadMode === "youtube" ? "링크 영상은 인코딩 없이 바로 시청 가능 상태로 추가됩니다." : "업로드는 우상단 작업박스에서 진행되며, 이 창을 닫아도 이어집니다."}
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={handleClose}>
              {isUploading ? "닫기" : "취소"}
            </Button>
            <Button
              intent="primary"
              onClick={handleSubmit}
              disabled={!canSubmit || isUploading}
              loading={isUploading}
            >
              {uploadMode === "youtube"
                ? isUploading
                  ? "추가 중…"
                  : "링크 추가"
                : isUploading
                  ? "업로드 중…"
                  : initErrorMessages.length > 0
                    ? `다시 시도 (${filledCount}개)`
                    : `업로드 (${filledCount}개)`}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
