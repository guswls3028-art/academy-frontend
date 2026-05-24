/**
 * 영상 홈 탭 — 강의 코스 그리드 (VideoHomePage에서 추출)
 */
import EmptyState from "@student/layout/EmptyState";
import { IconVideo } from "@student/shared/ui/icons/Icons";
import CourseCard from "./CourseCard";
import type { StudentVideoMeLecture, StudentVideoMePublic } from "../api/video.api";

type Props = {
  lectures: StudentVideoMeLecture[];
  publicData: StudentVideoMePublic;
};

export default function VideoHomeTab({ lectures, publicData }: Props) {
  const hasLectures = lectures.length > 0;
  const hasPublic = (publicData?.video_count ?? 0) > 0;

  if (!hasLectures && !hasPublic) {
    return (
      <EmptyState
        title="등록된 영상이 없습니다"
        description="공개 영상이나 수강 중인 강의 영상이 여기에 표시됩니다."
        icon={<IconVideo className="stu-emptystate__icon-svg" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="video-home-stack">
      <div
        data-guide="video-courses"
        className="video-course-grid"
      >
        {hasPublic && publicData && (
          <CourseCard
            title="공개 강의실"
            thumbnailUrl={publicData.thumbnail_url ?? null}
            videoCount={publicData.video_count ?? 0}
            totalDuration={publicData.total_duration ?? 0}
            progress={0}
            isNew={false}
            isContinue={false}
            isCompleted={false}
            to="/student/video/courses/public"
          />
        )}
        {lectures.map((lec) => {
          if (!lec.video_count) return null;
          return (
            <CourseCard
              key={lec.id}
              title={lec.title}
              thumbnailUrl={lec.thumbnail_url ?? null}
              videoCount={lec.video_count ?? 0}
              totalDuration={lec.total_duration ?? 0}
              progress={0}
              isNew={false}
              isContinue={false}
              isCompleted={false}
              to={`/student/video/courses/${lec.id}`}
            />
          );
        })}
      </div>
    </div>
  );
}
