// PATH: src/student/domains/video/components/CourseCard.tsx
// 프리미엄 SaaS 인강 느낌의 코스 카드 컴포넌트

import { Link } from "react-router-dom";
import { IconPlay, IconChevronRight } from "@/student/shared/ui/icons/Icons";
import { formatDuration } from "../utils/format";

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

export default function CourseCard({
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
      {...props}
      className="media-tile"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
      }}
    >
      {/* 썸네일 영역 */}
      <div
        className="media-tile__thumb"
        style={{
          position: "relative",
          background: "#111",
        }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, var(--stu-surface-soft) 0%, var(--stu-surface) 100%)",
            }}
          >
            <IconPlay style={{ width: 48, height: 48, color: "var(--stu-text-muted)", opacity: 0.5 }} />
          </div>
        )}
        
        {/* 재생 오버레이 - Media Tile System (hover 제거) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.15)",
            opacity: 0.6,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              display: "grid",
              placeItems: "center",
              transform: "scale(0.9)",
              transition: "transform 0.2s ease",
            }}
          >
            <IconPlay style={{ width: 28, height: 28, color: "#000", marginLeft: 2 }} />
          </div>
        </div>

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
      <div style={{ marginTop: 6 }}>
        <div className="media-tile__title" style={{ fontWeight: 600, color: "var(--stu-text)" }}>
          {title}
        </div>
      </div>
    </Component>
  );
}
