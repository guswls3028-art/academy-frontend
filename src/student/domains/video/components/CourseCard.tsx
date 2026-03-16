// PATH: src/student/domains/video/components/CourseCard.tsx
// 프리미엄 SaaS 인강 느낌의 코스 카드 컴포넌트

import { memo } from "react";
import { Link } from "react-router-dom";
import { IconPlay, IconChevronRight } from "@/student/shared/ui/icons/Icons";
import { formatDuration } from "../utils/format";
import VideoThumbnailWrapper from "./VideoThumbnailWrapper";

type CourseCardProps = {
  title: string;
  thumbnailUrl?: string | null;
  videoCount?: number;
  totalDuration?: number; // seconds
  progress?: number; // 0-100
  isNew?: boolean;
  isContinue?: boolean;
  isCompleted?: boolean;
  to: string;
  onClick?: () => void;
};

function CourseCard({
  title,
  thumbnailUrl,
  videoCount = 0,
  totalDuration,
  progress = 0,
  isNew = false,
  isContinue = false,
  isCompleted = false,
  to,
  onClick,
}: CourseCardProps) {
  const Component = onClick ? "button" : Link;
  const props = onClick
    ? { onClick, type: "button" as const }
    : { to, style: { textDecoration: "none", color: "inherit" } };

  return (
    <Component
      {...(props as any)}
      className="media-tile"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        borderRadius: 12,
        overflow: "hidden",
        background: "#1a1a1a",
        border: "2px solid rgba(255,255,255,0.15)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        cursor: "pointer",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "translateY(-3px) scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "translateY(-6px)";
      }}
    >
      {/* 질감 오버레이 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      
      {/* 썸네일 영역 */}
      <div
        className="media-tile__thumb"
        style={{
          position: "relative",
          background: "#111",
          zIndex: 0,
          aspectRatio: "16 / 9",
          overflow: "hidden",
        }}
      >
        {thumbnailUrl ? (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <VideoThumbnailWrapper
              title={title}
              thumbnail_url={thumbnailUrl}
              status="READY"
            />
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              background: "var(--stu-gradient, linear-gradient(135deg, #6b7280, #4b5563))",
            }}
          >
            <IconPlay style={{ width: 48, height: 48, color: "rgba(255,255,255,0.9)", opacity: 0.8 }} />
          </div>
        )}

        {/* YouTube-style 영상 갯수 오버레이 */}
        {videoCount > 0 && (
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              background: "rgba(0,0,0,0.82)",
              borderTopLeftRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              letterSpacing: 0.2,
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <IconChevronRight style={{ width: 12, height: 12, opacity: 0.8 }} />
            {videoCount}개 영상
          </div>
        )}

        {/* 진행률 바 */}
        {progress > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--stu-primary)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}

        {/* 뱃지 */}
        {(isNew || isContinue || isCompleted) && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              display: "flex",
              gap: 4,
            }}
          >
            {isNew && (
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                NEW
              </span>
            )}
            {isContinue && (
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "var(--stu-primary)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                이어보기
              </span>
            )}
            {isCompleted && (
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "#22c55e",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                완료
              </span>
            )}
          </div>
        )}
      </div>

      {/* 정보 영역 */}
      <div style={{ marginTop: 6, padding: "0 4px 8px", position: "relative", zIndex: 1 }}>
        <div className="media-tile__title" style={{ fontWeight: 600, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
          {title}
        </div>
      </div>
    </Component>
  );
}

export default memo(CourseCard);
