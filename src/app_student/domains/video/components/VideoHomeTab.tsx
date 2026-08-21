/**
 * 영상 홈 탭 — 강의 코스 그리드 (VideoHomePage에서 추출)
 */
import EmptyState from "@student/layout/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { IconChevronRight, IconNotice, IconVideo } from "@student/shared/ui/icons/Icons";
import { fetchStudentNotices } from "@student/shared/api/notices.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import CourseCard from "./CourseCard";
import type { StudentVideoArchivedLecture, StudentVideoMeLecture, StudentVideoMePublic } from "../api/video.api";

type Props = {
  lectures: StudentVideoMeLecture[];
  publicData: StudentVideoMePublic;
  archivedLectures: StudentVideoArchivedLecture[];
};

function formatWatchDuration(seconds: number) {
  const minutes = Math.floor(Math.max(seconds, 0) / 60);
  if (minutes < 60) return `${minutes}분 시청`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 시청`;
}

export default function VideoHomeTab({ lectures, publicData, archivedLectures }: Props) {
  const hasLectures = lectures.length > 0;
  const hasPublic = (publicData?.video_count ?? 0) > 0;
  const { data: notices, isLoading: noticesLoading, isError: noticesError } = useQuery({
    queryKey: studentQueryKeys.notices,
    queryFn: () => fetchStudentNotices(),
    enabled: hasLectures,
    staleTime: 60 * 1000,
  });
  const lectureIds = new Set(lectures.map((lecture) => lecture.id));
  const lectureNotices = (notices ?? []).filter((notice) =>
    notice.mappings?.some((mapping) => (
      mapping.node_detail?.level === "COURSE" &&
      lectureIds.has(mapping.node_detail.lecture)
    )),
  );
  const firstLectureNotice = lectureNotices[0];
  const firstLectureScope = firstLectureNotice?.mappings?.find((mapping) => (
    mapping.node_detail?.level === "COURSE" &&
    lectureIds.has(mapping.node_detail.lecture)
  ))?.node_detail;

  const noticeSummary = noticesLoading
    ? "강의 공지를 확인하고 있어요."
    : noticesError
      ? "공지 목록에서 선생님 안내를 다시 확인할 수 있어요."
      : firstLectureNotice
        ? `${firstLectureScope?.lecture_title ?? "수강 강의"} · ${firstLectureNotice.title}`
        : "새 공지가 올라오면 이곳에서 바로 찾을 수 있어요.";

  if (!hasLectures && !hasPublic && archivedLectures.length === 0) {
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
      {hasLectures && (
        <Link
          to="/student/notices?tab=lecture"
          className="video-lecture-notice"
          data-testid="lecture-notice-entry"
          aria-busy={noticesLoading}
        >
          <span className="video-lecture-notice__mark" aria-hidden="true">
            <IconNotice />
          </span>
          <span className="video-lecture-notice__copy">
            <strong className="video-lecture-notice__title">강의 공지</strong>
            <span className="video-lecture-notice__summary">{noticeSummary}</span>
          </span>
          <span className="video-lecture-notice__action">
            <span>{noticesLoading ? "확인 중" : lectureNotices.length > 0 ? `${lectureNotices.length}건` : "바로가기"}</span>
            <IconChevronRight aria-hidden="true" />
          </span>
        </Link>
      )}
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
      {archivedLectures.length > 0 && (
        <details className="video-archive" data-testid="ended-lecture-history">
          <summary>
            <span><strong>종료된 강의</strong><small>성적과 시청 기록만 볼 수 있어요</small></span>
            <b>{archivedLectures.length}</b>
          </summary>
          <div className="video-archive__list">
            {archivedLectures.map((lecture) => (
              <article key={lecture.id}>
                <div><strong>{lecture.title}</strong><span>영상은 강의 종료로 재생할 수 없습니다.</span></div>
                <dl>
                  <div><dt>시청 완료</dt><dd>{lecture.completed_count}/{lecture.video_count}</dd></div>
                  <div><dt>재생</dt><dd>{lecture.play_count}회</dd></div>
                  <div><dt>시청 분량</dt><dd>{formatWatchDuration(lecture.watch_duration)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
