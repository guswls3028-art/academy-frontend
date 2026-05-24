// PATH: src/app_student/domains/video/components/CourseCard.tsx
// 프리미엄 SaaS 인강 느낌의 코스 카드 컴포넌트

import { memo } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { IconPlay } from "@student/shared/ui/icons/Icons";
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
  const progressStyle = { "--course-progress": `${progress}%` } as CSSProperties;

  const inner = (
    <>
      {/* 썸네일 영역 */}
      <div
        className="media-tile__thumb media-tile__thumb--course"
      >
        {thumbnailUrl ? (
          <div className="media-tile__thumb-inner">
            <VideoThumbnailWrapper
              title={title}
              thumbnail_url={thumbnailUrl}
              status="READY"
            />
          </div>
        ) : (
          <div className="media-tile__fallback">
            <IconPlay className="media-tile__fallback-icon" />
          </div>
        )}

        {/* 콘텐츠 수 오버레이 */}
        {videoCount > 0 && (
          <div className="media-tile__count">
            <IconPlay className="media-tile__count-icon" />
            {videoCount}
          </div>
        )}

        {/* 진행률 바 */}
        {progress > 0 && (
          <div className="media-tile__progress">
            <div className="media-tile__progress-fill" style={progressStyle} />
          </div>
        )}

        {/* 뱃지 */}
        {(isNew || isContinue || isCompleted) && (
          <div className="media-tile__badges">
            {isNew && (
              <span className="media-tile__badge media-tile__badge--new">
                NEW
              </span>
            )}
            {isContinue && (
              <span className="media-tile__badge media-tile__badge--continue">
                이어보기
              </span>
            )}
            {isCompleted && (
              <span className="media-tile__badge media-tile__badge--completed">
                완료
              </span>
            )}
          </div>
        )}
      </div>

      {/* 정보 영역 */}
      <div className="media-tile__content">
        <div className="media-tile__title media-tile__title--course">
          {title}
        </div>
        {(videoCount > 0 || (totalDuration != null && totalDuration > 0)) && (
          <div className="media-tile__meta">
            {videoCount > 0 && `영상 ${videoCount}개`}
            {videoCount > 0 && totalDuration != null && totalDuration > 0 && " · "}
            {totalDuration != null && totalDuration > 0 && formatDuration(totalDuration)}
          </div>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="media-tile media-tile--course"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className="media-tile media-tile--course"
    >
      {inner}
    </Link>
  );
}

export default memo(CourseCard);
