/**
 * 알림 페이지 — 클리닉 예약 승인, QnA 답변, 새 영상, 새 성적 등
 * 
 * 최적화:
 * - 알림 카운트와 실제 데이터를 동일한 쿼리 키로 공유하여 중복 호출 방지
 * - 로딩 상태 및 에러 처리 개선
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { useNotificationCounts } from "../hooks/useNotificationCounts";
import { useMarkNotificationsSeen } from "../hooks/useSeenNotifications";
import { fetchMyClinicBookingRequests } from "@student/domains/clinic/api/clinicBooking.api";
import { fetchMyQuestions, fetchMyCounselRequests } from "@student/domains/community/api/community.api";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { fetchMyGradesSummary } from "@student/domains/grades/api/grades.api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { IconChevronRight, IconClinic, IconNotice } from "@student/shared/ui/icons/Icons";
import EmptyState from "@student/layout/EmptyState";
import { formatYmd } from "@student/shared/utils/date";
import styles from "./NotificationsPage.module.css";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isRecent(timestamp: string | null | undefined, cutoffTime: number): boolean {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  return Number.isFinite(time) && time > cutoffTime;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data: counts, isLoading: countsLoading, isError: countsError } = useNotificationCounts();

  const { data: clinicBookings, isLoading: clinicLoading, isError: clinicError } = useQuery({
    queryKey: studentQueryKeys.clinicBookings,
    queryFn: fetchMyClinicBookingRequests,
    staleTime: 30000,
  });

  const { data: profile } = useQuery({ queryKey: studentQueryKeys.me, queryFn: fetchMyProfile });

  const { data: myQnaQuestions = [], isLoading: qnaLoading, isError: qnaError } = useQuery({
    queryKey: studentQueryKeys.qnaQuestions,
    queryFn: () => fetchMyQuestions(profile!.id, 50),
    enabled: profile?.id != null,
    staleTime: 30000,
  });

  const { data: myCounselRequests = [], isLoading: counselLoading, isError: counselError } = useQuery({
    queryKey: studentQueryKeys.counselRequests,
    queryFn: () => fetchMyCounselRequests(profile!.id, 50),
    enabled: profile?.id != null,
    staleTime: 30000,
  });

  const { data: gradesSummary, isLoading: gradesLoading, isError: gradesError } = useQuery({
    queryKey: studentQueryKeys.gradesSummary,
    queryFn: fetchMyGradesSummary,
    staleTime: 30000,
  });

  const isLoading = countsLoading || clinicLoading || qnaLoading || counselLoading || gradesLoading;
  const isError = countsError || clinicError || qnaError || counselError || gradesError;
  const recentCutoffTime = useMemo(() => Date.now() - SEVEN_DAYS_MS, []);

  const approvedClinicBookings = useMemo(
    () => (clinicBookings || []).filter((booking) => {
      if (booking.status !== "booked") return false;
      return isRecent(booking.status_changed_at ?? booking.updated_at ?? booking.created_at, recentCutoffTime);
    }),
    [clinicBookings, recentCutoffTime],
  );

  const answeredQnaPosts = useMemo(
    () => myQnaQuestions.filter((post) => {
      if ((post.replies_count || 0) === 0) return false;
      return isRecent(post.updated_at ?? post.created_at, recentCutoffTime);
    }),
    [myQnaQuestions, recentCutoffTime],
  );

  const answeredCounselPosts = useMemo(
    () => myCounselRequests.filter((post) => {
      if ((post.replies_count || 0) === 0) return false;
      return isRecent(post.updated_at ?? post.created_at, recentCutoffTime);
    }),
    [myCounselRequests, recentCutoffTime],
  );

  const newGrades = useMemo(
    () => (gradesSummary?.exams || []).filter((exam) => {
      if (exam.meta_status === "NOT_SUBMITTED") return false;
      return isRecent(exam.submitted_at, recentCutoffTime);
    }),
    [gradesSummary?.exams, recentCutoffTime],
  );

  const hasNotifications =
    (counts?.total || 0) > 0 ||
    approvedClinicBookings.length > 0 ||
    answeredQnaPosts.length > 0 ||
    answeredCounselPosts.length > 0 ||
    newGrades.length > 0;

  const seenItems = useMemo(() => [
    ...approvedClinicBookings.map((booking) => ({ type: "clinic", id: booking.id })),
    ...answeredQnaPosts.map((post) => ({ type: "qna", id: post.id })),
    ...answeredCounselPosts.map((post) => ({ type: "counsel", id: post.id })),
    ...newGrades.map((exam) => ({ type: "grade", id: exam.exam_id })),
  ], [approvedClinicBookings, answeredQnaPosts, answeredCounselPosts, newGrades]);

  // 알림 페이지 진입 시 현재 보이는 항목들을 "읽음" 처리
  const markSeen = useMarkNotificationsSeen();
  const markedRef = useRef<string>("");
  useEffect(() => {
    if (isLoading) return;
    if (seenItems.length === 0) return;
    // 동일 항목 세트면 중복 호출 방지
    const key = seenItems.map((item) => `${item.type}:${item.id}`).join(",");
    if (key === markedRef.current) return;
    markedRef.current = key;
    markSeen(seenItems);
  }, [isLoading, seenItems, markSeen]);

  if (isLoading) {
    return (
      <StudentPageShell title="알림">
        <div className={styles.loadingStack}>
          <div className={`stu-skel ${styles.skelTitle}`} />
          <div className={`stu-skel ${styles.skelCard}`} />
          <div className={`stu-skel ${styles.skelCard}`} />
          <div className={`stu-skel ${styles.skelCard}`} />
        </div>
      </StudentPageShell>
    );
  }

  if (isError) {
    return (
      <StudentPageShell title="알림">
        <EmptyState
          title="알림을 불러오지 못했습니다"
          description="네트워크 연결을 확인하고 잠시 후 다시 시도해 주세요."
          onRetry={() => {
            qc.invalidateQueries({ queryKey: studentQueryKeys.clinicBookings });
            qc.invalidateQueries({ queryKey: studentQueryKeys.qnaQuestions });
            qc.invalidateQueries({ queryKey: studentQueryKeys.me });
            qc.invalidateQueries({ queryKey: studentQueryKeys.gradesSummary });
            qc.invalidateQueries({ queryKey: studentQueryKeys.notificationCounts });
          }}
        />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="알림">
      {!hasNotifications ? (
        <EmptyState
          title="알림이 없습니다"
          description="새로운 알림이 오면 여기에 표시됩니다."
        />
      ) : (
        <div className={styles.stack}>
          <div className={styles.summaryPanel}>
            <div className={styles.summaryCopy}>
              <span className={styles.summaryEyebrow}>최근 7일</span>
              <strong className={styles.summaryTitle}>{seenItems.length}개 알림</strong>
              <span className={styles.summaryMeta}>예약, 답변, 성적 업데이트를 모았습니다.</span>
            </div>
            <span className={styles.summaryBadge}>
              {Math.max(counts?.total ?? 0, seenItems.length)}
            </span>
          </div>

          {/* 클리닉 예약 승인 */}
          {approvedClinicBookings.length > 0 && (
            <NotificationSection icon={<IconClinic className={styles.sectionIcon} />} title="클리닉 예약" count={approvedClinicBookings.length}>
              {approvedClinicBookings.map((booking) => (
                <NotificationLink
                  key={booking.id}
                  to="/student/clinic"
                  title="클리닉 예약이 승인되었습니다"
                  meta={`${formatYmd(booking.session_date)} ${booking.session_start_time?.slice(0, 5)}${booking.session_location ? ` @ ${booking.session_location}` : ""}`}
                />
              ))}
            </NotificationSection>
          )}

          {/* QnA 답변 */}
          {answeredQnaPosts.length > 0 && (
            <NotificationSection icon={<IconNotice className={styles.sectionIcon} />} title="질문 답변" count={answeredQnaPosts.length}>
              {answeredQnaPosts.map((post) => (
                <NotificationLink
                  key={post.id}
                  to="/student/community"
                  state={{ openQuestionId: post.id }}
                  title={post.title}
                  meta={`답변이 달렸습니다 · ${post.replies_count ?? 0}개`}
                />
              ))}
            </NotificationSection>
          )}

          {/* 새 성적 */}
          {newGrades.length > 0 && (
            <NotificationSection icon={<IconNotice className={styles.sectionIcon} />} title="새 성적" count={newGrades.length}>
              {newGrades.map((grade) => (
                <NotificationLink
                  key={grade.exam_id}
                  to="/student/grades"
                  title={grade.title}
                  meta={`${grade.lecture_title || ""}${grade.session_title ? ` · ${grade.session_title}` : ""} · 결과 보기`}
                />
              ))}
            </NotificationSection>
          )}

          {/* 상담 답변 */}
          {answeredCounselPosts.length > 0 && (
            <NotificationSection icon={<IconNotice className={styles.sectionIcon} />} title="상담 답변" count={answeredCounselPosts.length}>
              {answeredCounselPosts.map((post) => (
                <NotificationLink
                  key={post.id}
                  to="/student/community"
                  state={{ openCounselId: post.id }}
                  title={post.title}
                  meta={`상담 답변이 달렸습니다 · ${post.replies_count ?? 0}개`}
                />
              ))}
            </NotificationSection>
          )}
        </div>
      )}
    </StudentPageShell>
  );
}

function NotificationSection({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        {icon}
        <h3 className={styles.sectionTitle}>{title}</h3>
        <span className={styles.sectionCount}>{count}건</span>
      </div>
      <div className={styles.list}>{children}</div>
    </section>
  );
}

function NotificationLink({
  to,
  state,
  title,
  meta,
}: {
  to: string;
  state?: unknown;
  title: string;
  meta: ReactNode;
}) {
  return (
    <Link
      to={to}
      state={state}
      className={`stu-panel stu-panel--pressable ${styles.card}`}
    >
      <div className={styles.cardText}>
        <div className={styles.itemTitle}>{title}</div>
        <div className={`stu-muted ${styles.itemMeta}`}>{meta}</div>
      </div>
      <span className={styles.cardArrow} aria-hidden="true">
        <IconChevronRight className={styles.cardArrowIcon} />
      </span>
    </Link>
  );
}
