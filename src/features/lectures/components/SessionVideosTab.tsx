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
import { feedback } from "@/shared/ui/feedback/feedback";

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
    onSuccess: (_data, videoId) => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
      asyncStatusStore.removeTask(String(videoId));
    },
  });

  /** 영상 제목 패턴(예: "수학의 정석 1", "수학의 정석 2")에서 묶음 base 추출. DB 변경 없이 표시용 그룹핑만. */
  const groupedVideos = useMemo(() => {
    const groups = new Map<string, MediaVideo[]>();
    const ungrouped: MediaVideo[] = [];
    const pattern = /^(.+)\s+(\d+)$/;

    for (const v of videos) {
      const m = v.title?.trim().match(pattern);
      if (m) {
        const base = m[1].trim();
        const list = groups.get(base) ?? [];
        list.push(v);
        list.sort((a, b) => {
          const na = parseInt(a.title?.match(/\s+(\d+)$/)?.[1] ?? "0", 10);
          const nb = parseInt(b.title?.match(/\s+(\d+)$/)?.[1] ?? "0", 10);
          return na - nb;
        });
        groups.set(base, list);
      } else {
        ungrouped.push(v);
      }
    }
    return { groups, ungrouped };
  }, [videos]);

  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/media/videos/${id}/retry/`);
      return res.data;
    },
    onSuccess: (_data, videoId) => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
      const video = videos.find((v: MediaVideo) => v.id === videoId);
      const label = video?.title ? `${video.title} 재처리` : `영상 ${videoId} 재처리`;
      asyncStatusStore.addWorkerJob(label, String(videoId), "video_processing");
      feedback.success("재처리 요청을 보냈습니다. 우하단 진행 상황에서 확인할 수 있습니다.");
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "재처리 요청에 실패했습니다.";
      feedback.error(msg);
    },
  });

  const renderVideoCard = (video: MediaVideo) => {
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
          {(video.status === "FAILED" || video.status === "PROCESSING" || video.status === "UPLOADED") && (
            <Button
              intent="primary"
              size="sm"
              disabled={retryMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const msg =
                  "재처리할까요? 진행 중인 작업이 있으면 취소 후 큐에 올라갑니다.";
                if (window.confirm(msg)) {
                  retryMutation.mutate(video.id);
                }
              }}
            >
              재처리 요청
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
  };

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
          <div className="session-videos-tab__list" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {/* 묶음 단위 (제목 1, 제목 2, ... 패턴) — 폴더처럼 표시 */}
            {Array.from(groupedVideos.groups.entries()).map(([baseTitle, groupVideos]) => (
              <div key={baseTitle} className="session-videos-tab__group">
                <div
                  className="session-videos-tab__group-header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    marginBottom: "var(--space-3)",
                    paddingLeft: "var(--space-2)",
                    borderLeft: "3px solid var(--color-brand-primary)",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)" }}>{baseTitle}</span>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600 }}>
                    {groupVideos.length}개
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "var(--space-4)",
                  }}
                >
                  {groupVideos.map((video: MediaVideo) => renderVideoCard(video))}
                </div>
              </div>
            ))}
            {/* 묶음 아닌 단일 영상 */}
            {groupedVideos.ungrouped.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                {groupedVideos.ungrouped.map((video: MediaVideo) => renderVideoCard(video))}
              </div>
            )}
          </div>
        )}
      </div>

      <VideoUploadModal sessionId={sessionId} isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
