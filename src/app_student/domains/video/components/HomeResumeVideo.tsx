import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuthContext } from "@/auth/context/AuthContext";
import { getStudentSupportSessionInfo } from "@/shared/auth/supportPreviewSession";
import { fetchStudentSessionVideos } from "../api/video.api";
import { studentVideoQueryScope, studentVideoQueryKeys } from "../queryKeys";
import { readRecentStudentVideo } from "../utils/recentStudentVideo";
import { canPlayStudentVideo, isStudentVideoComplete } from "../utils/videoAccess";
import { getVideoResumePosition } from "../utils/videoPlaybackStorage";
import { formatDurationDetailed } from "../utils/format";
import styles from "../../dashboard/pages/DashboardPage.module.css";

export default function HomeResumeVideo() {
  const { user } = useAuthContext();
  const last = user?.tenantRole === "student" && !getStudentSupportSessionInfo()
    ? readRecentStudentVideo(user.id) : null;
  const catalog = useQuery({
    queryKey: studentVideoQueryKeys.sessionVideos(studentVideoQueryScope(user), last?.sessionId, last?.enrollmentId),
    queryFn: () => fetchStudentSessionVideos(last!.sessionId, last!.enrollmentId),
    enabled: last !== null,
    staleTime: 0,
  });
  if (!last) return null;
  if (catalog.isError) return <div className={styles.resumeRecovery} role="status">
    이어볼 영상을 확인하지 못했어요. <Link to="/student/video">영상 목록 열기</Link>
  </div>;
  const video = catalog.data?.items.find(item => item.id === last.videoId);
  if (!video || !canPlayStudentVideo(video) || isStudentVideoComplete(video)) return null;
  const position = getVideoResumePosition(video.id, { userId: user?.id, enrollmentId: last.enrollmentId },
    video.last_position ?? last.position, undefined, last.enrollmentId === null);
  if (position <= 0 || (video.duration != null && video.duration > 0 && position >= video.duration)) return null;
  const query = new URLSearchParams({ video: String(video.id), session: String(last.sessionId) });
  if (last.enrollmentId !== null) query.set("enrollment", String(last.enrollmentId));
  return <section className={styles.homeAction} aria-label="이어서 보기">
    <div className={styles.actionLabel}>이어서 보기</div>
    <h2>{video.title}</h2><p>{formatDurationDetailed(position)}부터{video.duration ? ` · 전체 ${formatDurationDetailed(video.duration)}` : ""}</p>
    <Link className={styles.actionLink} to={`/student/video/play?${query}`}>이어서 재생</Link>
  </section>;
}
