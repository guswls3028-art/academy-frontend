/**
 * PATH: src/app_admin/domains/videos/pages/VideoExplorerPage.tsx
 *
 * 영상 도메인 「오늘의 작업」 탭 — KPI 인박스 + 처리 중/재시도 인박스
 * 부모 VideoDomainLayout 이 제목/탭을 제공한다.
 */
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/shared/ui/confirm";
import { Button, KPI } from "@/shared/ui/ds";
import {
  fetchVideosLandingStats,
  type LandingVideoSummary,
} from "../api/landingStats";
import { retryVideo, getRetryErrorMessage, type VideoStatus } from "../api/videos.api";
import { logRetryAttempt, logRetryError } from "@/shared/api/retryLogger";
import VideoStatusBadge from "../ui/VideoStatusBadge";
import VideoDetailOverlay from "./VideoDetailOverlay";
import DashboardWidget from "@admin/domains/dashboard/components/DashboardWidget";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";

export default function VideoExplorerPage() {
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-videos-landing-stats"],
    queryFn: fetchVideosLandingStats,
    staleTime: 60_000,
    refetchInterval: (query) => {
      // 인코딩 진행 중이거나 실패 영상이 있으면 30초마다 갱신
      const d = query.state.data;
      if (!d) return false;
      return d.processing > 0 || d.failed > 0 ? 30_000 : false;
    },
  });

  const fmt = (n: number | undefined): string => {
    if (isError) return "—";
    if (isLoading || n == null) return "…";
    return `${n}`;
  };

  const retryMutation = useMutation({
    mutationFn: async (payload: { videoId: number; title?: string }) => {
      logRetryAttempt(payload.videoId);
      await retryVideo(payload.videoId);
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["admin-videos-landing-stats"] });
      asyncStatusStore.addWorkerJob(
        payload.title ? `${payload.title} 재시도` : `영상 ${payload.videoId} 재시도`,
        String(payload.videoId),
        "video_processing"
      );
      feedback.success("재시도 요청을 보냈습니다.");
    },
    onError: (e: unknown, payload) => {
      const msg = getRetryErrorMessage(e);
      if (payload?.videoId != null) logRetryError(payload.videoId, msg);
      feedback.error(msg);
    },
  });

  const openDetail = (v: LandingVideoSummary) => {
    if (v.lecture_id == null || v.session_id == null) {
      feedback.error("이 영상의 강의·차시 정보를 찾지 못했습니다.");
      return;
    }
    setSearchParams(
      {
        videoId: String(v.id),
        lectureId: String(v.lecture_id),
        sessionId: String(v.session_id),
      },
      { replace: true }
    );
  };

  return (
    <div className="flex flex-col gap-6" style={{ padding: 0 }}>
      {/* 1) 요약 지표 */}
      <DashboardWidget title="요약 지표" description="영상 운영 현황">
        <div
          style={{
            display: "grid",
            gap: "var(--space-3)",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
          data-testid="videos-kpi-grid"
        >
          <KPI
            label="등록된 영상"
            value={fmt(data?.total)}
            hint={data?.ready != null ? `사용 가능 ${data.ready}개` : undefined}
          />
          <KPI
            label="처리 중"
            value={fmt(data?.processing)}
            hint={(data?.processing ?? 0) > 0 ? "보통 5~30분 (긴 영상은 90분까지)" : undefined}
          />
          <KPI
            label="다시 시도 필요"
            value={fmt(data?.failed)}
            hint={(data?.failed ?? 0) > 0 ? "실패 — 다시 시도 또는 삭제" : undefined}
          />
          <KPI label="최근 7일 업로드" value={fmt(data?.uploaded_last_7d)} />
        </div>
      </DashboardWidget>

      {/* 2) 처리 중 인박스 */}
      <DashboardWidget
        title="처리 중인 영상"
        description={
          isError
            ? "불러오기 실패"
            : (data?.processing ?? 0) === 0
              ? "현재 처리 중인 영상이 없습니다."
              : `${data?.processing_top.length ?? 0}개 표시 (총 ${data?.processing ?? 0}개)`
        }
      >
        {(data?.processing_top.length ?? 0) > 0 ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
            data-testid="videos-processing-inbox"
          >
            {data!.processing_top.map((v) => (
              <VideoRow key={v.id} v={v} onClick={() => openDetail(v)} rightLabel="상세" />
            ))}
          </div>
        ) : null}
      </DashboardWidget>

      {/* 3) 다시 시도 필요 인박스 */}
      <DashboardWidget
        title="다시 시도 필요"
        description={
          isError
            ? "불러오기 실패"
            : (data?.failed ?? 0) === 0
              ? "다시 시도할 영상이 없습니다."
              : `${data?.failed_top.length ?? 0}개 표시 (총 ${data?.failed ?? 0}개)`
        }
      >
        {(data?.failed_top.length ?? 0) > 0 ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
            data-testid="videos-failed-inbox"
          >
            {data!.failed_top.map((v) => (
              <VideoRow
                key={v.id}
                v={v}
                onClick={() => openDetail(v)}
                rightLabel="재시도"
                rightAction={async (e) => {
                  e.stopPropagation();
                  const ok = await confirm({
                    title: "영상 다시 시도",
                    message: "다시 시도할까요? 진행 중인 작업이 있으면 취소 후 다시 제출됩니다.",
                    confirmText: "다시 시도",
                  });
                  if (ok) retryMutation.mutate({ videoId: v.id, title: v.title });
                }}
                rightDisabled={retryMutation.isPending}
              />
            ))}
          </div>
        ) : null}
      </DashboardWidget>

      <VideoOverlayMount />
    </div>
  );
}

/**
 * 인박스에서도 ?videoId=...&lectureId=...&sessionId=... 쿼리 파라미터로
 * 영상 상세 오버레이를 띄울 수 있게 하는 마운트 포인트.
 */
function VideoOverlayMount() {
  const [searchParams, setSearchParams] = useSearchParams();
  const overlayVideoId = searchParams.get("videoId") ? Number(searchParams.get("videoId")) : null;
  const overlayLectureId = searchParams.get("lectureId") ? Number(searchParams.get("lectureId")) : null;
  const overlaySessionId = searchParams.get("sessionId") ? Number(searchParams.get("sessionId")) : null;
  const isOpen = overlayVideoId != null && overlayLectureId != null && overlaySessionId != null;

  if (!isOpen) return null;

  return (
    <VideoDetailOverlay
      videoId={overlayVideoId!}
      lectureId={overlayLectureId!}
      sessionId={overlaySessionId!}
      onClose={() => setSearchParams({}, { replace: true })}
    />
  );
}

function VideoRow({
  v,
  onClick,
  rightLabel,
  rightAction,
  rightDisabled,
}: {
  v: LandingVideoSummary;
  onClick: () => void;
  rightLabel: string;
  rightAction?: (e: React.MouseEvent) => void;
  rightDisabled?: boolean;
}) {
  const subtitleParts: string[] = [];
  if (v.lecture_title) subtitleParts.push(v.lecture_title);
  if (v.session_order) subtitleParts.push(`${v.session_order}차시`);
  const subtitle = subtitleParts.join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        width: "100%",
        padding: "12px 16px",
        cursor: "pointer",
        background: "var(--color-bg-surface-soft, #f9fafb)",
        border: "1px solid var(--color-border-divider)",
        borderRadius: 10,
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <VideoStatusBadge status={v.status as VideoStatus} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {v.title || "(제목 없음)"}
          </span>
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
      {rightAction ? (
        <Button
          intent="primary"
          size="sm"
          disabled={rightDisabled}
          onClick={rightAction}
        >
          {rightLabel}
        </Button>
      ) : (
        <span
          style={{
            flexShrink: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--color-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {rightLabel} →
        </span>
      )}
    </div>
  );
}
