// PATH: src/app_admin/domains/videos/components/VideoReorderModal.tsx
// 재생목록 순서 관리 모달 — VideoExplorerPage, SessionVideosTab 공용

import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateVideo } from "../api/videos.api";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { formatRoundedVideoDuration } from "../utils/videoFormat";
import "./VideoReorderModal.css";

/** Minimal video shape — works with both Video (videos API) and MediaVideo (session tab) */
interface ReorderVideo {
  id: number;
  title: string;
  order?: number;
  duration?: number | null;
  thumbnail_url?: string | null;
  session_id?: number;
}

interface VideoReorderModalProps {
  open: boolean;
  onClose: () => void;
  videos: ReorderVideo[];
  /** 차시 이름 (SessionVideosTab에서 전달) */
  sessionTitle?: string;
  /** 세션 이름 맵: session_id → label (VideoExplorerPage에서 전달, 크로스 세션 표시용) */
  sessionNameMap?: Map<number, string>;
  onSaved: () => void;
}

export default function VideoReorderModal({
  open,
  onClose,
  videos,
  sessionTitle,
  sessionNameMap,
  onSaved,
}: VideoReorderModalProps) {
  const queryClient = useQueryClient();

  // Local reordered list — initialized from props
  const [orderedVideos, setOrderedVideos] = useState<ReorderVideo[]>([]);

  useEffect(() => {
    if (open) {
      // Sort by current order, then title, then id (same logic as pages)
      const sorted = [...videos].sort((a, b) => {
        const orderDiff = (a.order ?? 1) - (b.order ?? 1);
        if (orderDiff !== 0) return orderDiff;
        const titleCmp = (a.title ?? "").localeCompare(b.title ?? "", "ko");
        return titleCmp !== 0 ? titleCmp : a.id - b.id;
      });
      setOrderedVideos(sorted);
    }
  }, [open, videos]);

  // Track which video IDs changed order
  const changedCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < orderedVideos.length; i++) {
      const original = videos.find((v) => v.id === orderedVideos[i].id);
      // New order is i+1; compare with original order
      if (original && (original.order ?? 1) !== i + 1) {
        count++;
      }
    }
    return count;
  }, [orderedVideos, videos]);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setOrderedVideos((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setOrderedVideos((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Only update videos whose order actually changed
      const updates: Promise<unknown>[] = [];
      for (let i = 0; i < orderedVideos.length; i++) {
        const video = orderedVideos[i];
        const newOrder = i + 1;
        if ((video.order ?? 1) !== newOrder) {
          updates.push(updateVideo(video.id, { order: newOrder }));
        }
      }
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-videos"] });
      feedback.success("영상 순서를 저장했습니다.");
      onSaved();
      onClose();
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "순서 저장에 실패했습니다.";
      feedback.error(msg);
    },
  });

  const handleSave = () => {
    if (changedCount === 0) return;
    saveMutation.mutate();
  };

  // Edge case: 0 or 1 video
  const isEmpty = videos.length === 0;
  const isSingle = videos.length === 1;

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.md}>
      <ModalHeader
        title={sessionTitle ? `순서 관리 — ${sessionTitle}` : "순서 관리"}
      />
      <ModalBody>
        {isEmpty ? (
          <div className="video-reorder-empty">
            영상이 없습니다
          </div>
        ) : isSingle ? (
          <div className="video-reorder-empty">
            순서를 변경할 영상이 없습니다
          </div>
        ) : (
          <div className="modal-scroll-body video-reorder-list">
            {/* Header */}
            <div className="video-reorder-header">
              <span />
              <span>순서</span>
              <span>영상</span>
              <span className="video-reorder-header-action">이동</span>
            </div>

            {/* Video rows */}
            {orderedVideos.map((video, index) => {
              const dur = formatRoundedVideoDuration(video.duration);
              const sessionLabel =
                sessionNameMap && video.session_id != null
                  ? sessionNameMap.get(video.session_id)
                  : null;

              return (
                <div
                  key={video.id}
                  className={[
                    "video-reorder-row",
                    index % 2 === 1 && "video-reorder-row--alt",
                  ].filter(Boolean).join(" ")}
                >
                  {/* Grip icon (visual only) */}
                  <div className="video-reorder-grip">
                    <GripVertical size={16} />
                  </div>

                  {/* Order number */}
                  <span className="video-reorder-index">
                    #{index + 1}
                  </span>

                  {/* Video info */}
                  <div className="video-reorder-info">
                    {/* Thumbnail */}
                    <div className="video-reorder-thumb">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt=""
                          className="video-reorder-thumb-image"
                        />
                      ) : (
                        <span className="video-reorder-thumb-empty">
                          없음
                        </span>
                      )}
                    </div>

                    {/* Title + meta */}
                    <div className="video-reorder-title-wrap">
                      <div
                        className="video-reorder-title"
                        title={video.title}
                      >
                        {video.title || "—"}
                      </div>
                      <div className="video-reorder-meta">
                        {dur && <span>{dur}</span>}
                        {sessionLabel && (
                          <>
                            {dur && <span>·</span>}
                            <span>{sessionLabel}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Move buttons */}
                  <div className="video-reorder-actions">
                    <button
                      type="button"
                      disabled={index === 0 || saveMutation.isPending}
                      onClick={() => moveUp(index)}
                      className="video-reorder-move"
                      title="위로 이동"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={
                        index === orderedVideos.length - 1 ||
                        saveMutation.isPending
                      }
                      onClick={() => moveDown(index)}
                      className="video-reorder-move"
                      title="아래로 이동"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Change summary */}
            {changedCount > 0 && (
              <div className="video-reorder-summary">
                {changedCount}개 영상 순서가 변경됩니다
              </div>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter
        left={
          <Button intent="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            취소
          </Button>
        }
        right={
          !isEmpty && !isSingle ? (
            <Button
              intent="primary"
              onClick={handleSave}
              disabled={changedCount === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? "저장 중…" : "저장"}
            </Button>
          ) : undefined
        }
      />
    </AdminModal>
  );
}
