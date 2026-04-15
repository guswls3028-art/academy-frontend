/**
 * 영상 홈 탭 — 강의 코스 그리드 (VideoHomePage에서 추출)
 */
import EmptyState from "@student/layout/EmptyState";
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
        description="공개 영상이나 수강 중인 강의의 차시 영상이 여기에 표시됩니다."
      />
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: "var(--stu-space-4)" }}>
        수강 가능한 강의
      </h2>
      <div
        data-guide="video-courses"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 16,
        }}
      >
        {hasPublic && publicData && (
          <CourseCard
            title="전체공개영상"
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
