// PATH: src/features/videos/ui/VideoThumbnail.tsx

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/ds";
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
 * - 🔁 수동 재처리(캐시 무효화) 버튼
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

  const refreshThumbnail = () => {
    if (!resolved) return;
    const v = Date.now();
    const next =
      resolved.includes("?")
        ? `${resolved}&v=${v}`
        : `${resolved}?v=${v}`;
    setSrc(next);
  };

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

      {/* 인코딩 중: 썸네일 영역에 진행률 오버레이 (우하단 진행 상황 패널과 동일 디자인 톤) */}
      {showProgressOverlay && (
        <div
          className="video-thumbnail-progress"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: 12,
            borderRadius: "inherit",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
            {isQueuedOrWaiting ? "대기 중" : "인코딩 중"}
          </span>
          {encodingStep ? (
            <>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", width: "100%", textAlign: "center" }}>
                <span style={{ fontWeight: 600 }}>[{encodingStep.index}/{encodingStep.total}]</span>{" "}
                {encodingStep.name}
              </div>
              <div className="async-status-bar__progress-row" style={{ width: "100%", maxWidth: 240 }}>
                <div className="async-status-bar__progress">
                  <div
                    className="async-status-bar__progress-fill"
                    style={{ width: `${encodingStep.percent}%` }}
                  />
                </div>
                <span className="async-status-bar__progress-pct">{encodingStep.percent}%</span>
              </div>
              {progressNum != null && progressNum > 0 && (
                <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                  전체 진행률: {progressNum}%
                </span>
              )}
            </>
          ) : (
            <>
              <div className="async-status-bar__progress-row" style={{ width: "100%", maxWidth: 240 }}>
                <div className="async-status-bar__progress">
                  <div
                    className={
                      progressNum != null
                        ? "async-status-bar__progress-fill"
                        : "async-status-bar__progress-fill async-status-bar__progress-fill--indeterminate"
                    }
                    style={progressNum != null ? { width: `${progressNum}%` } : undefined}
                  />
                </div>
                {progressNum != null && (
                  <span className="async-status-bar__progress-pct" style={{ color: "rgba(255,255,255,0.95)" }}>
                    {progressNum}%
                  </span>
                )}
              </div>
              {remainingLabel && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{remainingLabel}</span>
              )}
              {progressNum == null && !remainingLabel && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  {isQueuedOrWaiting ? "인코딩 대기 중…" : "진행률 계산 중…"}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {resolved && !showProgressOverlay && (
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            refreshThumbnail();
          }}
          className="absolute bottom-2 right-2 !bg-black/60 hover:!bg-black/80 !text-white !border-0"
        >
          ↺ 썸네일 새로고침
        </Button>
      )}
    </div>
  );
}
