// PATH: src/features/lectures/components/SessionVideosTab.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import VideoUploadModal from "@/features/videos/components/features/video-detail/modals/VideoUploadModal";
import VideoThumbnail from "@/features/videos/ui/VideoThumbnail";
import VideoStatusBadge from "@/features/videos/ui/VideoStatusBadge";

import { useSessionVideos } from "../hooks/useSessionVideos";

/**
 * media 도메인 기준 Video 타입 (관리자 목록용)
 * ⚠️ status 필드 반드시 포함
 */
export interface MediaVideo {
  id: number;
  title: string;
  file: string | null;
  file_key?: string | null;

  source_type: "s3" | "file" | "youtube" | "external" | "unknown";

  youtube_id?: string | null;
  external_url?: string | null;

  duration?: number | null;
  file_size?: number | null;
  thumbnail_url?: string | null;

  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;

  status?: "PENDING" | "UPLOADED" | "PROCESSING" | "READY" | "FAILED";

  created_at: string;
}

interface SessionVideosTabProps {
  sessionId: number;
}

export default function SessionVideosTab({ sessionId }: SessionVideosTabProps) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // --------------------------------------------------
  // FETCH
  // --------------------------------------------------
  const { data: videos = [], isLoading } = useSessionVideos(sessionId);

  // --------------------------------------------------
  // DELETE
  // --------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/media/videos/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
    },
  });

  // --------------------------------------------------
  // RETRY (FAILED → 재처리)
  // --------------------------------------------------
  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/media/videos/${id}/retry/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-base font-medium text-[var(--text-secondary)]">
          해당 차시에 등록된 영상 목록입니다.
        </div>

        <button
          className="btn"
          onClick={() => setShowModal(true)}
        >
          영상 추가
        </button>
      </div>

      {/* List */}
      <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 shadow-sm">
        {isLoading && (
          <div className="p-3 text-base text-[var(--text-muted)]">
            로딩중...
          </div>
        )}

        {!isLoading && videos.length === 0 && (
          <div className="p-3 text-base text-[var(--text-muted)]">
            등록된 영상이 없습니다.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video: MediaVideo) => {
            const fileSize =
              video.file_size && video.file_size > 0
                ? `${(video.file_size / 1024 / 1024).toFixed(2)}MB`
                : "-";

            const uploadDate = video.created_at
              ? new Date(video.created_at).toLocaleString("ko-KR", {
                  year: "2-digit",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
              : "-";

            return (
              <div
                key={video.id}
                className="group rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] p-3 shadow-sm transition hover:bg-[var(--bg-surface-soft)]"
              >
                {/* Thumbnail → Detail */}
                <Link to={`${video.id}`}>
                  <VideoThumbnail
                    title={video.title}
                    status={video.status ?? "PENDING"}
                    thumbnail_url={video.thumbnail_url}
                  />
                </Link>

                {/* Title + Status */}
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="text-sm leading-tight text-[var(--text-primary)]">
                    <div className="text-base font-semibold">
                      {video.title}
                    </div>

                    {fileSize !== "-" && (
                      <div className="text-sm text-[var(--text-muted)]">
                        {fileSize} · {uploadDate}
                      </div>
                    )}
                  </div>

                  <VideoStatusBadge status={video.status} />
                </div>

                {/* Policy summary */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                  <span>
                    워터마크:{" "}
                    <span
                      className={
                        video.show_watermark
                          ? "font-semibold text-[var(--color-primary)]"
                          : "font-semibold text-[var(--text-muted)]"
                      }
                    >
                      {video.show_watermark ? "표시" : "숨김"}
                    </span>
                  </span>

                  <span className="text-[var(--text-muted)]">|</span>

                  <span>
                    건너뛰기:{" "}
                    <span
                      className={
                        video.allow_skip
                          ? "font-semibold text-[var(--text-muted)]"
                          : "font-semibold text-[var(--color-primary)]"
                      }
                    >
                      {video.allow_skip ? "허용" : "금지"}
                    </span>
                  </span>

                  <span className="text-[var(--text-muted)]">|</span>

                  <span>
                    배속:{" "}
                    <span
                      className={
                        video.max_speed > 1.0
                          ? "font-semibold text-[var(--text-muted)]"
                          : "font-semibold text-[var(--color-primary)]"
                      }
                    >
                      {video.max_speed.toFixed(2)}x
                    </span>
                  </span>
                </div>

                {/* FAILED → Retry */}
                {video.status === "FAILED" && (
                  <div className="mt-3 flex justify-end">
                    <button
                      className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      disabled={retryMutation.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (window.confirm("영상 처리를 다시 시도할까요?")) {
                          retryMutation.mutate(video.id);
                        }
                      }}
                    >
                      재처리
                    </button>
                  </div>
                )}

                {/* Delete */}
                <div className="mt-2 flex justify-end">
                  <button
                    className="text-sm text-[var(--text-muted)] hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      if (window.confirm("정말 삭제하시겠습니까?")) {
                        deleteMutation.mutate(video.id);
                      }
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Modal */}
      <VideoUploadModal
        sessionId={sessionId}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
