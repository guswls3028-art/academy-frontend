import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ClipboardCheck, FileUp, Play, TrendingUp } from "lucide-react";
import { ICON } from "@/shared/ui/ds/iconSize";
import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import EmptyState from "../../../layout/EmptyState";
import { useSessionDetail } from "@student/domains/sessions/hooks/useStudentSessions";
import { formatYmd } from "@student/shared/utils/date";
import SessionExamAction from "../components/SessionExamAction";
import SessionAssignmentAction from "../components/SessionAssignmentAction";
import styles from "./SessionDetailPage.module.css";

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const safeId = Number(sessionId);

  const { data, isLoading, isError, refetch } = useSessionDetail(
    Number.isFinite(safeId) ? safeId : undefined
  );

  if (!Number.isFinite(safeId)) {
    return (
      <StudentPageShell breadcrumbs={[{ label: "수업 목록", to: "/student/sessions" }]} title="차시" description="잘못된 접근입니다.">
        <EmptyState title="잘못된 주소입니다." />
      </StudentPageShell>
    );
  }

  if (isLoading) {
    return (
      <StudentPageShell breadcrumbs={[{ label: "수업 목록", to: "/student/sessions" }]} title="차시">
        <p className={styles.scheduleNote} role="status">수업 정보를 불러오는 중이에요.</p>
      </StudentPageShell>
    );
  }

  if (isError || !data) {
    return (
      <StudentPageShell breadcrumbs={[{ label: "수업 목록", to: "/student/sessions" }]} title="차시">
        <EmptyState title="수업 정보를 불러오지 못했어요." description="잠시 후 다시 시도해 주세요." onRetry={() => refetch()} />
      </StudentPageShell>
    );
  }

  const time = [data.start_time?.slice(0, 5), data.end_time?.slice(0, 5)].filter(Boolean).join(" ~ ");
  const dateLabel = `날짜: ${formatYmd(data.date ?? null)}`;
  let description = dateLabel;
  if (data.schedule_configured) {
    description = data.date
      ? [data.schedule_label, dateLabel, time].filter(Boolean).join(" · ")
      : "수업일 미배정";
  }

  return (
    <StudentPageShell breadcrumbs={[{ label: "수업 목록", to: "/student/sessions" }]} title={data.title} description={description}>
      {data.schedule_configured && (
        <p className={styles.scheduleNote}>
          {!data.date && "아직 배정된 수업일이 없어요. 배정되면 내 일정에 표시됩니다. "}
          영상·시험·과제는 이 차시의 모든 수업일이 함께 사용해요.
        </p>
      )}
      <ul className={styles.actions} role="list" aria-label="차시 학습">
        <ActionRow title="영상" icon={<Play size={ICON.sm} aria-hidden="true" />}>
          <Link to={`/student/video/sessions/${data.id}`} className="stu-btn stu-btn--primary" data-size="md">
            영상으로 이동
          </Link>
        </ActionRow>
        <ActionRow title="시험" icon={<ClipboardCheck size={ICON.sm} aria-hidden="true" />}>
          <SessionExamAction examIds={data.exam_ids ?? undefined} sessionId={data.id} />
        </ActionRow>
        <ActionRow title="과제" icon={<FileUp size={ICON.sm} aria-hidden="true" />}>
          <SessionAssignmentAction sessionId={data.id} />
        </ActionRow>
        <ActionRow title="성적" icon={<TrendingUp size={ICON.sm} aria-hidden="true" />}>
          <Link to="/student/grades" className="stu-btn stu-btn--secondary" data-size="md">
            성적 보기
          </Link>
        </ActionRow>
      </ul>
    </StudentPageShell>
  );
}

function ActionRow({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <li className={styles.actionRow}>
      <span className={styles.actionTitle}>{icon}{title}</span>
      {children}
    </li>
  );
}
