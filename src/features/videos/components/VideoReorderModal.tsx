// PATH: src/features/videos/components/VideoReorderModal.tsx
// 재생목록 순서 관리 모달 — VideoExplorerPage, SessionVideosTab 공용

import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateVideo, type Video } from "../api/videos";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";

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

/** duration(초) → "MM:SS" or "H:MM:SS" */
function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
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
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              color: "var(--color-text-muted)",
              fontSize: 14,
            }}
          >
            영상이 없습니다
          </div>
        ) : isSingle ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              color: "var(--color-text-muted)",
              fontSize: 14,
            }}
          >
            순서를 변경할 영상이 없습니다
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 60px 1fr 80px",
                gap: 8,
                padding: "6px 8px",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-text-muted)",
                borderBottom: "1px solid var(--color-border-divider)",
                marginBottom: 4,
              }}
            >
              <span />
              <span>순서</span>
              <span>영상</span>
              <span style={{ textAlign: "center" }}>이동</span>
            </div>

            {/* Video rows */}
            {orderedVideos.map((video, index) => {
              const dur = formatDuration(video.duration);
              const sessionLabel =
                sessionNameMap && video.session_id != null
                  ? sessionNameMap.get(video.session_id)
                  : null;

              return (
                <div
                  key={video.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 60px 1fr 80px",
                    gap: 8,
                    padding: "8px",
                    alignItems: "center",
                    borderRadius: 8,
                    background:
                      index % 2 === 0
                        ? "transparent"
                        : "var(--color-bg-surface-soft)",
                    transition: "background 100ms",
                  }}
                >
                  {/* Grip icon (visual only) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-disabled)",
                    }}
                  >
                    <GripVertical size={16} />
                  </div>

                  {/* Order number */}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--color-text-secondary)",
                      background: "var(--color-bg-surface-soft)",
                      borderRadius: 6,
                      padding: "2px 8px",
                      textAlign: "center",
                      lineHeight: "22px",
                    }}
                  >
                    #{index + 1}
                  </span>

                  {/* Video info */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: 60,
                        height: 40,
                        borderRadius: 6,
                        overflow: "hidden",
                        flexShrink: 0,
                        background: "var(--color-bg-surface-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--color-text-disabled)",
                          }}
                        >
                          없음
                        </span>
                      )}
                    </div>

                    {/* Title + meta */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={video.title}
                      >
                        {video.title || "—"}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-muted)",
                          marginTop: 2,
                          display: "flex",
                          gap: 6,
                        }}
                      >
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
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      justifyContent: "center",
                    }}
                  >
                    <button
                      type="button"
                      disabled={index === 0 || saveMutation.isPending}
                      onClick={() => moveUp(index)}
                      style={{
                        width: 28,
                        height: 28,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--color-border-divider)",
                        borderRadius: 6,
                        background:
                          index === 0
                            ? "var(--color-bg-surface-soft)"
                            : "var(--color-bg-app)",
                        color:
                          index === 0
                            ? "var(--color-text-disabled)"
                            : "var(--color-text-secondary)",
                        cursor: index === 0 ? "not-allowed" : "pointer",
                        padding: 0,
                        transition: "background 100ms, border-color 100ms",
                      }}
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
                      style={{
                        width: 28,
                        height: 28,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--color-border-divider)",
                        borderRadius: 6,
                        background:
                          index === orderedVideos.length - 1
                            ? "var(--color-bg-surface-soft)"
                            : "var(--color-bg-app)",
                        color:
                          index === orderedVideos.length - 1
                            ? "var(--color-text-disabled)"
                            : "var(--color-text-secondary)",
                        cursor:
                          index === orderedVideos.length - 1
                            ? "not-allowed"
                            : "pointer",
                        padding: 0,
                        transition: "background 100ms, border-color 100ms",
                      }}
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
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--color-bg-surface-soft)",
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
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
