// PATH: src/app_admin/domains/lectures/components/SessionVideosTab.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { getRetryErrorMessage, updateVideo } from "@admin/domains/videos/api/videos.api";
import { canShowRetryButton } from "@admin/domains/videos/constants/videoProcessing";
import { logRetryAttempt, logRetryError } from "@/shared/api/retryLogger";
import VideoUploadModal from "@admin/domains/videos/components/features/video-detail/modals/VideoUploadModal";
import VideoThumbnail from "@admin/domains/videos/ui/VideoThumbnail";
import VideoStatusBadge from "@admin/domains/videos/ui/VideoStatusBadge";
import { useAsyncStatus, asyncStatusStore } from "@/shared/ui/asyncStatus";

import { useSessionVideos } from "../hooks/useSessionVideos";
import { Button, EmptyState, Badge } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import VideoEditModal from "@admin/domains/videos/components/features/video-detail/modals/VideoEditModal";
import VideoReorderModal from "@admin/domains/videos/components/VideoReorderModal";
import styles from "./SessionVideosTab.module.css";

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

  order?: number;

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
  const confirm = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<MediaVideo | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const asyncTasks = useAsyncStatus();

  const { data: rawVideos = [], isLoading } = useSessionVideos(sessionId);
  const videos = useMemo(
    () =>
      [...rawVideos].sort((a: MediaVideo, b: MediaVideo) => {
        const orderDiff = (a.order ?? 1) - (b.order ?? 1);
        if (orderDiff !== 0) return orderDiff;
        const titleCmp = (a.title ?? "").localeCompare(b.title ?? "", "ko");
        return titleCmp !== 0 ? titleCmp : a.id - b.id;
      }),
    [rawVideos]
  );

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
      feedback.success("재시도 요청을 보냈습니다. 우상단 작업박스에서 확인할 수 있습니다.");
    },
    onError: (e: unknown, videoId) => {
      const msg = getRetryErrorMessage(e);
      logRetryError(videoId, msg);
      feedback.error(msg);
    },
  });

  /** Map video ID → index in flat sorted array (for reorder buttons) */
  const videoIndexMap = useMemo(() => {
    const m = new Map<number, number>();
    videos.forEach((v, i) => m.set(v.id, i));
    return m;
  }, [videos]);

  /** Swap order of two videos (optimistic) */
  const reorderMutation = useMutation({
    mutationFn: async ({ videoA, videoB }: { videoA: MediaVideo; videoB: MediaVideo }) => {
      const orderA = videoA.order ?? 1;
      const orderB = videoB.order ?? 1;
      await Promise.all([
        updateVideo(videoA.id, { order: orderB }),
        updateVideo(videoB.id, { order: orderA }),
      ]);
    },
    onMutate: async ({ videoA, videoB }) => {
      await qc.cancelQueries({ queryKey: ["session-videos", sessionId] });
      const prev = qc.getQueryData<MediaVideo[]>(["session-videos", sessionId]);
      if (prev) {
        const orderA = videoA.order ?? 1;
        const orderB = videoB.order ?? 1;
        qc.setQueryData<MediaVideo[]>(["session-videos", sessionId], (old) =>
          (old ?? []).map((v) => {
            if (v.id === videoA.id) return { ...v, order: orderB };
            if (v.id === videoB.id) return { ...v, order: orderA };
            return v;
          })
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["session-videos", sessionId], ctx.prev);
      feedback.error("순서 변경에 실패했습니다.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
    },
  });

  const handleMoveUp = (index: number) => {
    if (index <= 0 || reorderMutation.isPending) return;
    reorderMutation.mutate({ videoA: videos[index], videoB: videos[index - 1] });
  };

  const handleMoveDown = (index: number) => {
    if (index >= videos.length - 1 || reorderMutation.isPending) return;
    reorderMutation.mutate({ videoA: videos[index], videoB: videos[index + 1] });
  };

  const renderVideoCard = (video: MediaVideo, globalIndex?: number) => {
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
        className={styles.card}
      >
        {/* Order controls */}
        {globalIndex != null && (
          <div className={styles.orderBar}>
            <span className={styles.orderIndex}>
              #{video.order ?? globalIndex + 1}
            </span>
            <div className={styles.orderActions}>
              <button
                type="button"
                disabled={globalIndex === 0 || reorderMutation.isPending}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMoveUp(globalIndex); }}
                className={styles.orderButton}
                title="위로 이동"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={globalIndex === videos.length - 1 || reorderMutation.isPending}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMoveDown(globalIndex); }}
                className={styles.orderButton}
                title="아래로 이동"
              >
                ▼
              </button>
            </div>
          </div>
        )}

        <Link to={`${video.id}`} className={styles.thumbnailLink}>
          <VideoThumbnail
            title={video.title}
            status={video.status ?? "PENDING"}
            thumbnail_url={video.thumbnail_url}
            progress={videoTask?.progress}
            remainingSeconds={videoTask?.remainingSeconds}
            encodingStep={videoTask?.encodingStep ?? undefined}
          />
        </Link>

        <div className={styles.metaRow}>
          <div className={styles.metaMain}>
            <div className={styles.title}>
              {video.title}
            </div>

            {/* 유튜브 스타일: 조회수 · N시간 전 (제목 바로 아래) */}
            {(viewCountLabel || timeAgo) && (
              <div className={styles.subMeta}>
                {[viewCountLabel, timeAgo].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>

          <div className={styles.statusSlot}>
            <VideoStatusBadge status={video.status} />
          </div>
        </div>

        <div className={styles.badges}>
          <Badge variant="solid" tone={video.show_watermark ? "info" : "neutral"}>
            {video.show_watermark ? "워터마크" : "워터마크 없음"}
          </Badge>
          <Badge variant="solid" tone={video.allow_skip ? "neutral" : "warning"}>
            {video.allow_skip ? "건너뛰기 허용" : "건너뛰기 금지"}
          </Badge>
          <Badge variant="solid" tone="neutral">
            최대 {video.max_speed.toFixed(2)}x
          </Badge>
        </div>

        <div className={styles.actions}>
          {canShowRetryButton(video) && (
            <Button
              intent="primary"
              size="sm"
              disabled={retryMutation.isPending}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const ok = await confirm({ title: "확인", message: "재시도할까요? 진행 중인 작업이 있으면 취소 후 다시 제출됩니다.", danger: false, confirmText: "확인" });
                if (!ok) return;
                retryMutation.mutate(video.id);
              }}
            >
              {retryMutation.isPending ? "요청 중…" : "재시도"}
            </Button>
          )}
          <Button
            intent="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditTarget(video);
            }}
          >
            수정
          </Button>
          <Button
            intent="ghost"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const ok = await confirm({ title: "삭제 확인", message: "정말 삭제하시겠습니까?", danger: true, confirmText: "삭제" });
              if (!ok) return;
              deleteMutation.mutate(video.id);
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
          <div className={styles.toolbarActions}>
            {videos.length > 1 && (
              <Button intent="ghost" onClick={() => setReorderOpen(true)}>
                순서 관리
              </Button>
            )}
            <Button intent="primary" onClick={() => setShowModal(true)}>
              영상 추가
            </Button>
          </div>
        }
      />

      <div
        className={`ds-panel ${styles.panel}`}
      >
        {isLoading ? (
          <div
            className={`animate-pulse ${styles.grid}`}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={styles.skeletonCard}
              />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <EmptyState mode="embedded" scope="panel" title="등록된 영상이 없습니다." />
        ) : (
          <div className={styles.list}>
            {/* 묶음 단위 (제목 1, 제목 2, ... 패턴) — 폴더처럼 표시 */}
            {Array.from(groupedVideos.groups.entries()).map(([baseTitle, groupVideos]) => (
              <div key={baseTitle}>
                <div
                  className={styles.groupHeader}
                >
                  <span className={styles.groupTitle}>{baseTitle}</span>
                  <span className={styles.groupCount}>
                    {groupVideos.length}개
                  </span>
                </div>
                <div className={styles.grid}>
                  {groupVideos.map((video: MediaVideo) => renderVideoCard(video, videoIndexMap.get(video.id)))}
                </div>
              </div>
            ))}
            {/* 묶음 아닌 단일 영상 */}
            {groupedVideos.ungrouped.length > 0 && (
              <div className={styles.grid}>
                {groupedVideos.ungrouped.map((video: MediaVideo) => renderVideoCard(video, videoIndexMap.get(video.id)))}
              </div>
            )}
          </div>
        )}
      </div>

      <VideoUploadModal sessionId={sessionId} isOpen={showModal} onClose={() => setShowModal(false)} />

      {editTarget && (
        <VideoEditModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          videoId={editTarget.id}
          initialTitle={editTarget.title}
          initialOrder={editTarget.order ?? 1}
          sessionId={sessionId}
        />
      )}
      <VideoReorderModal
        open={reorderOpen}
        onClose={() => setReorderOpen(false)}
        videos={videos}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
        }}
      />
    </div>
  );
}
