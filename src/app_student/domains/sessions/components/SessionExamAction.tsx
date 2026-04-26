// PATH: src/app_student/domains/sessions/components/SessionExamAction.tsx
/**
 * SessionExamAction — 차시의 시험 진입 액션
 * exam_ids 배열이 있으면 각 시험으로 직접 링크, 없으면 시험 목록으로.
 *
 * 차시 시험이 1건 이상일 때 응시 상태 요약을 칩으로 표시
 *  (응시 가능 / 채점 완료). 기존 동선(버튼)은 그대로 유지.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStudentExams, type StudentExam } from "@student/domains/exams/api/exams.api";

type SessionExamActionProps = {
  examIds?: number[];
  sessionId?: number;
};

type Summary = {
  total: number;
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
  return { total: items.length, available, graded, urgent };
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "neutral" | "danger";
}) {
  return (
    <span
      className={`stu-badge stu-badge--${tone} stu-badge--sm`}
      style={{ marginRight: 6 }}
    >
      {label}
    </span>
  );
}

export default function SessionExamAction({ examIds, sessionId }: SessionExamActionProps) {
  const hasIds = Array.isArray(examIds) && examIds.length > 0;

  // 차시별 시험 목록을 student API로 한 번에 가져와 요약 계산
  const { data } = useQuery({
    queryKey: ["student-session-exams", sessionId ?? null],
    queryFn: () => fetchStudentExams({ session_id: sessionId! }),
    enabled: !!sessionId && hasIds,
    staleTime: 60 * 1000,
  });

  const summary: Summary | null = useMemo(() => {
    if (!data?.items?.length) return null;
    // exam_ids가 있으면 그 ID들로만 좁혀 정확도 보장
    const ids = new Set((examIds ?? []).map((n) => Number(n)));
    const filtered = ids.size > 0
      ? data.items.filter((e) => ids.has(Number(e.id)))
      : data.items;
    if (filtered.length === 0) return null;
    return summarize(filtered);
  }, [data, examIds]);

  if (!hasIds) {
    return (
      <Link to="/student/exams" className="stu-cta-link">
        시험 목록 보기
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {summary && (
        <div style={{ fontSize: 13 }}>
          {summary.urgent > 0 && (
            <StatusChip label={`마감 임박 ${summary.urgent}`} tone="danger" />
          )}
          {summary.available > 0 && (
            <StatusChip label={`응시 가능 ${summary.available}`} tone="warning" />
          )}
          {summary.graded > 0 && (
            <StatusChip label={`채점 완료 ${summary.graded}`} tone="success" />
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {examIds!.map((eid, idx) => (
          <Link key={eid} to={`/student/exams/${eid}`} className="stu-cta-link">
            {examIds!.length === 1 ? "시험 보기" : `${idx + 1}차 시험`}
          </Link>
        ))}
      </div>
    </div>
  );
}
