// PATH: src/features/lectures/components/SessionVideosTab.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { getRetryErrorMessage } from "@/features/videos/api/videos";
import { canShowRetryButton } from "@/features/videos/constants/videoProcessing";
import { logRetryAttempt, logRetryError } from "@/shared/api/retryLogger";
import VideoUploadModal from "@/features/videos/components/features/video-detail/modals/VideoUploadModal";
import VideoThumbnail from "@/features/videos/ui/VideoThumbnail";
import VideoStatusBadge from "@/features/videos/ui/VideoStatusBadge";
import { useAsyncStatus, asyncStatusStore } from "@/shared/ui/asyncStatus";

import { useSessionVideos } from "../hooks/useSessionVideos";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { feedback } from "@/shared/ui/feedback/feedback";

/** 유튜브 스타일: 업로드 시각 → "N분 전", "N시간 전", "N일 전" */
function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  if (diffSec < 60) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffWeek < 4) return `${diffWeek}주 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

/** 조회수 표기: 1234 → "1.2천 회", 10000+ → "1만 회" 등 */
function formatViewCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}만 회`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}천 회`;
  return `${count}회`;
}

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
  /** 조회수 (백엔드 목록 API에서 내려오면 표시, 유튜브 스타일) */
  view_count?: number | null;
}

interface SessionVideosTabProps {
  sessionId: number;
}

export default function SessionVideosTab({ sessionId }: SessionVideosTabProps) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const asyncTasks = useAsyncStatus();

  const { data: videos = [], isLoading } = useSessionVideos(sessionId);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/media/videos/${id}/`);
    },
    onSuccess: (_data, videoId) => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
      asyncStatusStore.removeTask(String(videoId));
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error)?.message ||
        "영상 삭제에 실패했습니다.";
      feedback.error(msg);
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
      logRetryAttempt(id);
      const res = await api.post(`/media/videos/${id}/retry/`);
      return res.data;
    },
    onSuccess: (_data, videoId) => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
      const video = videos.find((v: MediaVideo) => v.id === videoId);
      const label = video?.title ? `${video.title} 재시도` : `영상 ${videoId} 재시도`;
      asyncStatusStore.addWorkerJob(label, String(videoId), "video_processing");
      feedback.success("재시도 요청을 보냈습니다. 우하단 진행 상황에서 확인할 수 있습니다.");
    },
    onError: (e: unknown, videoId) => {
      const msg = getRetryErrorMessage(e);
      logRetryError(videoId, msg);
      feedback.error(msg);
    },
  });

  const renderVideoCard = (video: MediaVideo) => {
    const videoTask = asyncTasks.find(
      (t) => t.meta?.jobType === "video_processing" && t.meta?.jobId === String(video.id)
    );
    const timeAgo = video.created_at ? formatTimeAgo(video.created_at) : "";
    const viewCountLabel =
      video.view_count != null && Number.isFinite(video.view_count)
        ? `조회수 ${formatViewCount(video.view_count)}`
        : null;

    return (
      <div
        key={video.id}
        className="group"
        style={{
          borderRadius: 14,
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-app)",
          padding: 12,
          transition: "border-color 120ms ease, box-shadow 120ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-primary)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border-divider)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        <Link to={`${video.id}`} style={{ textDecoration: "none" }}>
          <VideoThumbnail
            title={video.title}
            status={video.status ?? "PENDING"}
            thumbnail_url={video.thumbnail_url}
            progress={videoTask?.progress}
            remainingSeconds={videoTask?.remainingSeconds}
            encodingStep={videoTask?.encodingStep ?? undefined}
          />
        </Link>

        <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--color-text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {video.title}
            </div>

            {/* 유튜브 스타일: 조회수 · N시간 전 (제목 바로 아래) */}
            {(viewCountLabel || timeAgo) && (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-muted)" }}>
                {[viewCountLabel, timeAgo].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>

          <div style={{ flex: "0 0 auto" }}>
            <VideoStatusBadge status={video.status} />
          </div>
        </div>

        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span className="ds-status-badge" data-tone={video.show_watermark ? "info" : "neutral"}>
            {video.show_watermark ? "워터마크" : "워터마크 없음"}
          </span>
          <span className="ds-status-badge" data-tone={video.allow_skip ? "neutral" : "warning"}>
            {video.allow_skip ? "건너뛰기 허용" : "건너뛰기 금지"}
          </span>
          <span className="ds-status-badge" data-tone="neutral">
            최대 {video.max_speed.toFixed(2)}x
          </span>
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {canShowRetryButton(video) && (
            <Button
              intent="primary"
              size="sm"
              disabled={retryMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const msg = "재시도할까요? 진행 중인 작업이 있으면 취소 후 다시 제출됩니다.";
                if (window.confirm(msg)) {
                  retryMutation.mutate(video.id);
                }
              }}
            >
              {retryMutation.isPending ? "요청 중…" : "재시도"}
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
          <div
            className="animate-pulse"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  borderRadius: 14,
                  border: "1px solid var(--color-border-divider)",
                  background: "var(--color-bg-surface-soft)",
                  padding: 12,
                  height: 220,
                }}
              />
            ))}
          </div>
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
