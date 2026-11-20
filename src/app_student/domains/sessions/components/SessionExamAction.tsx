import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { ICON_FOR_BUTTON } from "@/shared/ui/ds/iconSize";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchStudentExams, type StudentExam } from "@student/domains/exams/api/exams.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import styles from "./SessionExamAction.module.css";

type SessionExamActionProps = {
  examIds?: number[];
  sessionId?: number;
};

type Summary = {
  available: number;
  graded: number;
  urgent: number;
};

function summarize(items: StudentExam[]): Summary {
  const now = new Date();
  let available = 0;
  let graded = 0;
  let urgent = 0;
  for (const e of items) {
    if (e.has_result) {
      graded += 1;
      continue;
    }
    const close = e.close_at ? new Date(e.close_at) : null;
    if (close && close < now) continue; // 마감
    if (close) {
      const hours = (close.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hours <= 24) {
        urgent += 1;
        continue;
      }
    }
    available += 1;
  }
  return { available, graded, urgent };
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warn" | "danger";
}) {
  return (
    <span
      className={`stu-badge stu-badge--${tone} stu-badge--sm`}
    >
      {label}
    </span>
  );
}

export default function SessionExamAction({ examIds, sessionId }: SessionExamActionProps) {
  const examIdList = useMemo(
    () => (Array.isArray(examIds) ? examIds.map(Number).filter(Number.isFinite) : []),
    [examIds],
  );
  const hasIds = examIdList.length > 0;
  const examQueryParams = useMemo(
    () => (sessionId ? { session_id: sessionId } : undefined),
    [sessionId],
  );

  // 차시별 시험 목록을 student API로 한 번에 가져와 요약 계산
  const examsQ = useQuery({
    queryKey: studentQueryKeys.examsList(examQueryParams),
    queryFn: () => fetchStudentExams({ session_id: sessionId! }),
    enabled: !!sessionId && hasIds,
    staleTime: 60 * 1000,
  });
  const data = examsQ.data;

  const summary: Summary | null = useMemo(() => {
    if (!data?.items?.length) return null;
    // exam_ids가 있으면 그 ID들로만 좁혀 정확도 보장
    const ids = new Set(examIdList);
    const filtered = data.items.filter((exam) => ids.has(Number(exam.id)));
    if (filtered.length === 0) return null;
    return summarize(filtered);
  }, [data, examIdList]);

  if (!hasIds) {
    return (
      <Link to="/student/exams" className="stu-btn stu-btn--secondary" data-size="md">
        시험 목록 보기
      </Link>
    );
  }

  const hasMultipleExams = examIdList.length > 1;
  const examTitles = new Map(data?.items.map((exam) => [exam.id, exam.title.trim()]));
  const examLinks = examIdList.map((id, index) => (
    <Link key={id} to={`/student/exams/${id}`} className="stu-btn stu-btn--secondary" data-size="md">
      {hasMultipleExams ? examTitles.get(id) || `시험 ${index + 1}` : "시험 보기"}
    </Link>
  ));

  return (
    <div className={styles.examActions}>
      {(examsQ.isError || summary) && (
        <div className={styles.statusRow} aria-live="polite">
          {examsQ.isError && <StatusChip label="시험 상태 확인 실패" tone="danger" />}
          {!!summary?.urgent && <StatusChip label={`마감 임박 ${summary.urgent}`} tone="danger" />}
          {!!summary?.available && <StatusChip label={`응시 가능 ${summary.available}`} tone="warn" />}
          {!!summary?.graded && <StatusChip label={`채점 완료 ${summary.graded}`} tone="success" />}
        </div>
      )}
      {hasMultipleExams ? (
        <details className={styles.examChoices}>
          <summary className="stu-btn stu-btn--secondary" data-size="md">
            시험 선택 ({examIdList.length})
            <ChevronDown className={styles.chevron} size={ICON_FOR_BUTTON.md} aria-hidden="true" />
          </summary>
          <div className={styles.linkRow}>{examLinks}</div>
        </details>
      ) : examLinks[0]}
    </div>
  );
}
