// PATH: src/app_admin/domains/videos/ui/VideoThumbnail.tsx

import { useEffect, useState } from "react";
import "@/styles/design-system/components/AsyncStatusBar.css";

type VideoStatus = "READY" | "PROCESSING" | "FAILED" | "PENDING" | "UPLOADED";

/** 서버 파일 없이 404 방지 — data URL placeholder */
const PLACEHOLDER_VIDEO =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect fill="#e5e7eb" width="320" height="180"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="14" font-family="sans-serif">영상</text></svg>'
  );
const PLACEHOLDER_PROCESSING =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect fill="#1f2937" width="320" height="180"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="14" font-family="sans-serif">처리 중</text></svg>'
  );
const PLACEHOLDER_FAILED =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect fill="#374151" width="320" height="180"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ef4444" font-size="14" font-family="sans-serif">실패</text></svg>'
  );

/** 우하단 진행 상황 패널과 동일한 스타일의 인코딩 단계 정보 */
export interface EncodingStepInfo {
  index: number;
  total: number;
  name: string;
  percent: number;
}

interface Props {
  title?: string;
  status?: VideoStatus;
  thumbnail_url?: string | null;
  /** 인코딩 중일 때 진행률 0~100 (asyncStatusStore에서 연동) */
  progress?: number | null;
  /** 예상 남은 시간(초). 있으면 "약 N분 남음" 표시 */
  remainingSeconds?: number | null;
  /** 단계별 진행 [2/7] 단계명 45% */
  encodingStep?: EncodingStepInfo | null;
}

/**
 * ✅ SaaS 표준 Thumbnail
 * - thumbnail_url이 절대 URL이면 그대로 사용
 * - 상대 경로면 CDN BASE + default tenant 보정
 * - 실패 시 placeholder fallback
 * - 인코딩 중(PROCESSING/UPLOADED)이면 썸네일 영역에 진행률 오버레이 (우하단 진행 상황 패널과 동일 톤)
 */
export default function VideoThumbnail({
  title,
  status,
  thumbnail_url,
  progress,
  remainingSeconds,
  encodingStep,
}: Props) {
  const CDN_BASE = import.meta.env.VITE_MEDIA_CDN_BASE || "";

  const resolveThumbnailSrc = () => {
    if (!thumbnail_url) return null;

    // ✅ 이미 절대 URL이면 그대로
    if (thumbnail_url.startsWith("http://") || thumbnail_url.startsWith("https://")) {
      return thumbnail_url;
    }

    // ✅ 상대경로 + tenant 누락 → default 보정
    let path = thumbnail_url.replace(/^\/+/, "");

    if (path.startsWith("media/hls/videos/")) {
      // media/hls/videos/{video_id}/...  → default tenant 삽입
      path = path.replace(
        "media/hls/videos/",
        "media/hls/videos/default/videos/"
      );
    }

    return CDN_BASE ? `${CDN_BASE}/${path}` : `/${path}`;
  };

  let computedSrc = PLACEHOLDER_VIDEO;

  const resolved = resolveThumbnailSrc();
  if (resolved) {
    computedSrc = resolved;
  } else if (status === "PROCESSING") {
    computedSrc = PLACEHOLDER_PROCESSING;
  } else if (status === "FAILED") {
    computedSrc = PLACEHOLDER_FAILED;
  }

  const [src, setSrc] = useState(computedSrc);

  // ✅ props 변경 시 동기화
  useEffect(() => {
    setSrc(computedSrc);
  }, [computedSrc]);

  const isEncoding = status === "PROCESSING" || status === "UPLOADED";
  const showProgressOverlay = isEncoding;
  const progressNum = progress != null ? Math.round(progress) : null;
  const isQueuedOrWaiting =
    status === "UPLOADED" && progressNum == null && !encodingStep && (remainingSeconds == null || !Number.isFinite(remainingSeconds));
  const remainingLabel =
    remainingSeconds != null && Number.isFinite(remainingSeconds) && remainingSeconds >= 0
      ? remainingSeconds < 60
        ? `약 ${Math.max(1, Math.round(remainingSeconds))}초 남음`
        : `약 ${Math.round(remainingSeconds / 60)}분 남음`
      : null;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-md bg-gray-100 shadow-sm relative">
      {/* 인코딩 중이 아닐 때만 썸네일 이미지 표시 (인코딩 중엔 깨진/플레이스홀더 이미지 없음) */}
      {!showProgressOverlay && (
        <img
          src={src}
          alt={title || "영상 썸네일"}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => {
            setSrc(PLACEHOLDER_VIDEO);
          }}
        />
      )}

      {/* 인코딩 중: 썸네일 위 프리미엄 오버레이 — 하단 바 + 작은 % + 뱃지 */}
      {showProgressOverlay && (
        <>
          {/* 썸네일이 있으면 배경으로 보여주고, 없으면 어두운 배경만 */}
          {resolved && (
            <img
              src={src}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
              aria-hidden
            />
          )}
          <div
            className="video-thumbnail-encoding-overlay"
            style={{
              position: "absolute",
              inset: 0,
              background: resolved
                ? "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.85) 100%)"
                : "linear-gradient(180deg, #1f2937 0%, #111827 100%)",
              borderRadius: "inherit",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: 0,
            }}
          >
            {/* 상단 왼쪽: 상태 뱃지 */}
            <div className="video-thumbnail-encoding-overlay__badge">
              <span className="video-thumbnail-encoding-overlay__badge-dot" />
              {isQueuedOrWaiting ? "처리 대기" : "처리 중"}
            </div>

            {/* 중앙: 퍼센트는 적당한 크기로 (과하지 않게) */}
            <div className="video-thumbnail-encoding-overlay__pct-center">
              {progressNum != null ? (
                <span className="video-thumbnail-encoding-overlay__pct-num" aria-hidden>
                  {progressNum}%
                </span>
              ) : (
                <span className="video-thumbnail-encoding-overlay__pct-placeholder">—</span>
              )}
            </div>

            {/* 하단: 단계 정보 + 프로그레스 바 한 블록 */}
            <div className="video-thumbnail-encoding-overlay__footer">
              <div className="video-thumbnail-encoding-overlay__meta">
                {encodingStep ? (
                  <span className="video-thumbnail-encoding-overlay__step">
                    <span className="video-thumbnail-encoding-overlay__step-index">
                      [{encodingStep.index}/{encodingStep.total}]
                    </span>{" "}
                    {encodingStep.name} {encodingStep.percent}%
                  </span>
                ) : progressNum != null && progressNum < 100 ? (
                  <span className="video-thumbnail-encoding-overlay__step">전체 진행률</span>
                ) : null}
                {remainingLabel && (
                  <span className="video-thumbnail-encoding-overlay__remaining">{remainingLabel}</span>
                )}
                {progressNum == null && !remainingLabel && !encodingStep && (
                  <span className="video-thumbnail-encoding-overlay__remaining">
                    {isQueuedOrWaiting ? "곧 시작됩니다…" : "처리 중…"}
                  </span>
                )}
              </div>
              <div className="video-thumbnail-encoding-overlay__bar-wrap">
                <div className="video-thumbnail-encoding-overlay__bar">
                  <div
                    className="video-thumbnail-encoding-overlay__bar-fill"
                    style={{
                      width: `${encodingStep ? encodingStep.percent : progressNum ?? 0}%`,
                    }}
                  />
                </div>
                <span className="video-thumbnail-encoding-overlay__bar-pct">
                  {encodingStep != null
                    ? `${encodingStep.percent}%`
                    : progressNum != null
                      ? `${progressNum}%`
                      : "—"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 인코딩 완료(READY): 썸네일 좌상단에 시청가능 뱃지 — 초록 라이브 펄스 */}
      {status === "READY" && !showProgressOverlay && (
        <div
          className="video-thumbnail-ready-badge"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 2,
          }}
        >
          <span className="video-ready-live-badge">
            <span className="video-ready-live-dot" />
            시청가능
          </span>
        </div>
      )}
    </div>
  );
}
