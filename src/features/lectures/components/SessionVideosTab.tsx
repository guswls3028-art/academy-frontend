// PATH: src/features/lectures/components/SessionVideosTab.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import VideoUploadModal from "@/features/videos/components/features/video-detail/modals/VideoUploadModal";
import VideoThumbnail from "@/features/videos/ui/VideoThumbnail";
import VideoStatusBadge from "@/features/videos/ui/VideoStatusBadge";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";

import { useSessionVideos } from "../hooks/useSessionVideos";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";

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

  const { data: videos = [], isLoading } = useSessionVideos(sessionId);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/media/videos/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/media/videos/${id}/retry/`);
    },
    onSuccess: (_data, videoId) => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
      // 작업 박스에 재처리 태스크 추가 → 우하단에서 진행률 표시
      const video = videos.find((v: MediaVideo) => v.id === videoId);
      const label = video?.title ? `${video.title} 재처리` : `영상 ${videoId} 재처리`;
      asyncStatusStore.addWorkerJob(label, String(videoId), "video_processing");
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <DomainListToolbar
        totalLabel={isLoading ? "…" : `총 ${videos.length}개`}
        searchSlot={null}
        primaryAction={
          <Button intent="primary" onClick={() => setShowModal(true)}>
            영상 추가
          </Button>
        }
      />

      <div
        className="ds-panel"
        style={{
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
          padding: "var(--space-4)",
        }}
      >
        {isLoading ? (
          <EmptyState mode="embedded" scope="panel" tone="loading" title="불러오는 중…" />
        ) : videos.length === 0 ? (
          <EmptyState mode="embedded" scope="panel" title="등록된 영상이 없습니다." />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {videos.map((video: MediaVideo) => {
              const fileSize =
                video.file_size && video.file_size > 0 ? `${(video.file_size / 1024 / 1024).toFixed(2)}MB` : "-";

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
                  style={{
                    borderRadius: 14,
                    border: "1px solid var(--color-border-divider)",
                    background: "var(--color-bg-app)",
                    padding: 12,
                    transition: "background 120ms ease",
                  }}
                >
                  <Link to={`${video.id}`} style={{ textDecoration: "none" }}>
                    <VideoThumbnail
                      title={video.title}
                      status={video.status ?? "PENDING"}
                      thumbnail_url={video.thumbnail_url}
                    />
                  </Link>

                  <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 950,
                          color: "var(--color-text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {video.title}
                      </div>

                      {fileSize !== "-" && (
                        <div style={{ marginTop: 2, fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
                          {fileSize} · {uploadDate}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: "0 0 auto" }}>
                      <VideoStatusBadge status={video.status} />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      fontWeight: 850,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <span>
                      워터마크:{" "}
                      <span style={{ fontWeight: 950, color: video.show_watermark ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                        {video.show_watermark ? "표시" : "숨김"}
                      </span>
                    </span>

                    <span style={{ color: "var(--color-text-muted)" }}>·</span>

                    <span>
                      건너뛰기:{" "}
                      <span style={{ fontWeight: 950, color: video.allow_skip ? "var(--color-text-muted)" : "var(--color-primary)" }}>
                        {video.allow_skip ? "허용" : "금지"}
                      </span>
                    </span>

                    <span style={{ color: "var(--color-text-muted)" }}>·</span>

                    <span>
                      배속:{" "}
                      <span style={{ fontWeight: 950, color: video.max_speed > 1.0 ? "var(--color-text-muted)" : "var(--color-primary)" }}>
                        {video.max_speed.toFixed(2)}x
                      </span>
                    </span>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    {(video.status === "FAILED" || video.status === "PROCESSING") && (
                      <Button
                        intent="primary"
                        size="sm"
                        disabled={retryMutation.isPending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (window.confirm(video.status === "PROCESSING" ? "인코딩이 멈춘 것 같습니다. 다시 시도할까요?" : "영상 처리를 다시 시도할까요?")) {
                            retryMutation.mutate(video.id);
                          }
                        }}
                      >
                        {video.status === "PROCESSING" ? "다시 시도" : "재처리"}
                      </Button>
                    )}

                    <Button
                      intent="ghost"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.confirm("정말 삭제하시겠습니까?")) {
                          deleteMutation.mutate(video.id);
                        }
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <VideoUploadModal sessionId={sessionId} isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
