/**
 * 차시 상세 페이지 — 영상 목록 (작은 썸네일 구조)
 */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStudentSessionVideos, fetchStudentVideoPlayback, type StudentVideoListItem } from "../api/video.api";
import EmptyState from "@student/layout/EmptyState";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { IconChevronRight, IconPlay } from "@student/shared/ui/icons/Icons";
import { formatDuration, formatDurationDetailed } from "../utils/format";
import { resolveTenantCodeString } from "@/shared/tenant";
import {
  canPlayStudentVideo,
  isStudentVideoBlocked,
  isStudentVideoComplete,
  studentVideoAccessLabel,
  studentVideoProgressPercent,
  studentVideoUnavailableLabel,
} from "../utils/videoAccess";

function progressWidthStyle(value: number): CSSProperties {
  return { "--video-progress": `${Math.min(Math.max(value, 0), 100)}%` } as CSSProperties;
}

// 재생 목록 아이템 컴포넌트
function VideoStatusBadge({ status, accessMode }: { status: string; accessMode?: StudentVideoListItem["access_mode"] }) {
  if (accessMode === "BLOCKED") {
    return (
      <div className="video-status-overlay">
        <div className="video-status-label video-status-label--blocked">시청 제한</div>
      </div>
    );
  }

  // UPLOADED: 업로드 완료 + 인코딩 대기 — 재생 불가
  // PENDING: 업로드 진행 / PROCESSING: 인코딩 중
  const isEncoding =
    status === "PENDING" ||
    status === "UPLOADED" ||
    status === "PROCESSING";
  const isFailed = status === "FAILED";
  if (!isEncoding && !isFailed) return null;

  // 상태별 문구 세분화 (UX 개선)
  let label = "처리 중";
  if (isFailed) label = "처리 실패";
  else if (status === "PENDING") label = "업로드 중";
  else if (status === "UPLOADED") label = "처리 대기";
  else if (status === "PROCESSING") label = "인코딩 중";

  return (
    <div className="video-status-overlay">
      <div className={`video-status-label${isFailed ? " video-status-label--failed" : ""}`}>
        {label}
      </div>
    </div>
  );
}

function VideoListItem({
  video,
  enrollmentId,
  sessionId,
  isCurrent = false,
  onPrefetch,
}: {
  video: StudentVideoListItem;
  enrollmentId?: number | null;
  sessionId?: number | null;
  isCurrent?: boolean;
  onPrefetch?: (videoId: number) => void;
}) {
  const videoStatus = video.status ?? "READY";
  const isPlayable = canPlayStudentVideo(video);
  const isBlocked = isStudentVideoBlocked(video);
  const progress = studentVideoProgressPercent(video);
  const duration = video.duration ?? 0;
  const isComplete = isStudentVideoComplete(video);

  const href = isPlayable
    ? `/student/video/play?video=${video.id}${enrollmentId ? `&enrollment=${enrollmentId}` : ""}${sessionId ? `&session=${sessionId}` : ""}`
    : undefined;

  const metaItems = [
    duration > 0 ? formatDurationDetailed(duration) : null,
    isComplete ? "완료" : progress > 0 ? `${progress}% 진행` : "새로 시작",
  ].filter(Boolean);
  const kicker = isPlayable
    ? (isCurrent ? "이어보던 항목" : studentVideoAccessLabel(video.access_mode))
    : studentVideoUnavailableLabel(videoStatus, video.access_mode);

  const content = (
    <>
      <div className={`video-thumb${video.thumbnail_url ? "" : " video-thumb--placeholder"}`}>
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title} loading="lazy" />
        ) : (
          <span className="video-play-orb" aria-hidden="true">
            <IconPlay className="video-play-orb__icon" />
          </span>
        )}

        {!isPlayable && <VideoStatusBadge status={videoStatus} accessMode={video.access_mode} />}

        {duration > 0 && (
          <span className="video-thumb-badge">{formatDurationDetailed(duration)}</span>
        )}

        {progress > 0 && (
          <div className="video-progress-track" aria-hidden="true">
            <div className="video-progress-fill" style={progressWidthStyle(progress)} />
          </div>
        )}
      </div>

      <div className="video-card__body">
        <div className="video-card__kicker">
          {kicker}
        </div>
        <div className="video-card__title">{video.title}</div>
        <div className="video-card__meta">
          {metaItems.map((item) => (
            <span key={item} className="video-card__meta-item">{item}</span>
          ))}
        </div>
        {isPlayable && (
          <div className="video-card__cta">
            <span>{progress > 0 && progress < 100 ? "이어보기" : "재생하기"}</span>
            <IconChevronRight className="video-card__cta-icon" aria-hidden="true" />
          </div>
        )}
      </div>
    </>
  );

  if (!isPlayable) {
    return (
      <div className={`video-card video-card--disabled${isBlocked ? " video-card--blocked" : ""}`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      to={href!}
      className={`video-card${isCurrent ? " video-card--active" : ""}`}
      onTouchStart={() => { if (isPlayable && onPrefetch) onPrefetch(video.id); }}
      onMouseEnter={() => {
        if (onPrefetch) onPrefetch(video.id);
      }}
    >
      {content}
    </Link>
  );
}

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const routeState = (location.state || {}) as {
    sessionTitle?: string;
    courseTitle?: string;
    order?: number;
    isPublic?: boolean;
  };

  const sessionIdNum = sessionId ? parseInt(sessionId, 10) : null;
  const enrollmentId = searchParams.get("enrollment") ? parseInt(searchParams.get("enrollment")!, 10) : null;
  const currentVideoStorageKey = `student_current_video_id:${resolveTenantCodeString()}`;

  // Preload hls.js and player chunk for faster video playback start
  useEffect(() => {
    import("hls.js").catch(() => {});
    import("./VideoPlayerPage").catch(() => {});
  }, []);
  
  // 현재 재생 중인 영상 ID (localStorage에서 가져오기 - VideoPlayerPage에서 설정)
  // useMemo 대신 useState + useEffect 사용하여 Hook 순서 일관성 유지
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem(currentVideoStorageKey);
      setCurrentVideoId(stored ? parseInt(stored, 10) : null);
    } catch {
      setCurrentVideoId(null);
    }
    
    // localStorage 변경 감지 (다른 탭/창에서 변경 시)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === currentVideoStorageKey) {
        try {
          setCurrentVideoId(e.newValue ? parseInt(e.newValue, 10) : null);
        } catch {
          setCurrentVideoId(null);
        }
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [currentVideoStorageKey]);

  const { data: videosData, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["student-session-videos", sessionIdNum, enrollmentId],
    queryFn: () => fetchStudentSessionVideos(sessionIdNum!, enrollmentId),
    enabled: !!sessionIdNum,
    retry: false,
  });

  const videos = [...(videosData?.items ?? [])].sort((a, b) => {
    const orderDiff = (a.order ?? 1) - (b.order ?? 1);
    if (orderDiff !== 0) return orderDiff;
    const titleCmp = (a.title ?? "").localeCompare(b.title ?? "", "ko");
    return titleCmp !== 0 ? titleCmp : (a.id ?? 0) - (b.id ?? 0);
  });
  const res = (queryError as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const is403 = isError && res?.status === 403;
  const serverMessage =
    typeof res?.data?.detail === "string"
      ? res.data.detail
      : Array.isArray(res?.data?.detail)
        ? String(res.data.detail[0] ?? "")
        : null;

  const playableVideos = videos.filter(canPlayStudentVideo);
  const totalDuration = playableVideos.reduce((sum, v) => sum + (v.duration ?? 0), 0);
  const completedCount = playableVideos.filter(isStudentVideoComplete).length;
  const progressLabel = playableVideos.length > 0 ? `${completedCount}/${playableVideos.length} 완료` : "시청 가능한 항목 없음";
  const sessionTitle = routeState.sessionTitle || "재생 목록";
  const courseTitle = routeState.courseTitle || "영상 학습";

  if (isLoading) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content video-detail-skel">
          <div className="stu-skel video-detail-skel__hero" />
          <div className="stu-skel video-detail-skel__body video-detail-skel__body--compact" />
        </div>
      </StudentPageShell>
    );
  }

  if (is403) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content">
          <EmptyState
            title="영상을 볼 수 없습니다"
            description={serverMessage || "이 차시를 볼 수 있는 권한이 없습니다. 수강 중인 강의인지 확인하거나, 선생님에게 문의해 주세요."}
          />
        </div>
      </StudentPageShell>
    );
  }

  if (isError && !is403) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content">
          <EmptyState
            title="재생 목록을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
          />
        </div>
      </StudentPageShell>
    );
  }

  if (!sessionIdNum || videos.length === 0) {
    return (
      <StudentPageShell title="" noSectionFrame>
        <div className="video-page-content">
          <EmptyState
            title="차시를 찾을 수 없습니다"
            description="차시가 존재하지 않거나 영상이 없습니다."
          />
        </div>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="" noSectionFrame>
      <div className="video-page-content">
        <button type="button" className="video-back" onClick={() => nav(-1)}>
          <IconChevronRight className="video-back__icon" aria-hidden="true" />
          <span>차시 목록</span>
        </button>

        <section className="video-hero">
          <div className="video-hero__eyebrow">
            <IconPlay className="video-hero__icon" aria-hidden="true" />
            <span>{courseTitle}</span>
          </div>
          <h1 className="video-hero__title">
            {routeState.order && !routeState.isPublic ? `${routeState.order}차시 · ` : ""}
            {sessionTitle}
          </h1>
          <div className="video-hero__desc">
            영상을 선택하면 마지막으로 보던 지점부터 이어서 볼 수 있습니다.
          </div>
          <div className="video-hero__stats">
            <span className="video-stat-pill">영상 {videos.length}개</span>
            {playableVideos.length !== videos.length && (
              <span className="video-stat-pill">시청 가능 {playableVideos.length}개</span>
            )}
            {totalDuration > 0 && <span className="video-stat-pill">{formatDuration(totalDuration)}</span>}
            <span className="video-stat-pill">{progressLabel}</span>
          </div>
        </section>

        <section className="video-list" aria-label="재생 목록">
          <div className="video-section-head">
            <h2 className="video-section-title">재생 목록</h2>
            <span className="video-section-sub">{videos.length}개</span>
          </div>

          <div className="video-list">
            {videos.map((video) => {
              const isCurrent = currentVideoId === video.id;

              return (
                <VideoListItem
                  key={video.id}
                  video={video}
                  enrollmentId={enrollmentId}
                  sessionId={sessionIdNum}
                  isCurrent={isCurrent}
                  onPrefetch={(vid) => {
                    qc.prefetchQuery({
                      queryKey: ["student-video-playback", vid, enrollmentId],
                      queryFn: () => fetchStudentVideoPlayback(vid, enrollmentId ?? undefined),
                      staleTime: 60_000,
                    });
                  }}
                />
              );
            })}
          </div>
        </section>
      </div>
    </StudentPageShell>
  );
}
