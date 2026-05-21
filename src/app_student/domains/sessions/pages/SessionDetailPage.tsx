// src/app_student/domains/sessions/pages/SessionDetailPage.tsx
/**
 * ✅ SessionDetailPage (허브)
 * - 학생 앱의 "행동 중심 허브"
 * - 영상/시험/과제/자료 링크만 제공 (판단/계산 ❌)
 *
 * 주의:
 * - session → exam 연결 추론 ❌
 * - 백엔드가 exam_ids 등을 내려주면 그대로 사용
 * - 없으면 "시험으로 이동" 같은 범용 링크만 제공
 */

import { Link, useParams } from "react-router-dom";
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
      <StudentPageShell title="차시" description="잘못된 접근입니다.">
        <EmptyState title="잘못된 주소입니다." />
      </StudentPageShell>
    );
  }

  if (isLoading) {
    return (
      <StudentPageShell title="차시">
        <div className={styles.loadingStack}>
          <div className={`stu-skel ${styles.skelCard}`} />
          <div className={`stu-skel ${styles.skelCard}`} />
          <div className={`stu-skel ${styles.skelCard}`} />
        </div>
      </StudentPageShell>
    );
  }

  if (isError || !data) {
    return (
      <StudentPageShell title="차시">
        <EmptyState title="수업 정보를 불러오지 못했어요." description="잠시 후 다시 시도해 주세요." onRetry={() => refetch()} />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title={data.title} description={`날짜: ${formatYmd(data.date ?? null)}`}>
      <div className={styles.stack}>
        {/* ===== Primary: 영상 (가장 중요) ===== */}
        <ActionCard title="영상 보기" desc="이 수업의 영상을 볼 수 있어요." primary>
          <Link
            to={`/student/video/sessions/${data.id}`}
            className={styles.videoLink}
          >
            영상으로 이동
          </Link>
        </ActionCard>

        {/* ===== Secondary: 시험/과제 ===== */}
        <ActionCard title="시험/평가" desc="시험 목록 또는 해당 시험으로 이동합니다.">
          <SessionExamAction examIds={data.exam_ids ?? undefined} sessionId={data.id} />
        </ActionCard>

        <ActionCard title="과제 제출" desc="과제를 제출합니다.">
          <SessionAssignmentAction sessionId={data.id} />
        </ActionCard>

        {/* ===== Tertiary: 성적 ===== */}
        <ActionCard title="성적" desc="결과 요약 화면으로 이동합니다.">
          <Link to="/student/grades" className="stu-cta-link">
            성적 보기
          </Link>
        </ActionCard>

      </div>
    </StudentPageShell>
  );
}

function ActionCard({
  title,
  desc,
  children,
  primary,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <div className={primary ? `stu-section stu-panel--action ${styles.primaryCard}` : "stu-section"}>
      <div className={`stu-section-header ${styles.cardTitle}`}>
        {title}
      </div>
      <div className={`stu-muted ${styles.cardDescription}`}>{desc}</div>
      <div>{children}</div>
    </div>
  );
}
