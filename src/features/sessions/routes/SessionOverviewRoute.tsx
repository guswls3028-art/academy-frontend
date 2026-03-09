// PATH: src/features/sessions/routes/SessionOverviewRoute.tsx
// 차시 개요 탭 — 평가 운영 대시보드 (시험/과제 요약, 위험·미완료·바로가기)

import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { useSessionParams } from "../hooks/useSessionParams";
import { Button, EmptyState } from "@/shared/ui/ds";

type ScoreSummary = {
  participant_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
  pass_rate: number;
  clinic_rate: number;
  attempt_stats?: { avg_attempts?: number; retake_ratio?: number };
};

type ExamSummaryRow = {
  exam_id: number;
  title: string;
  participant_count: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  avg_score: number;
};

type ExamsSummary = {
  session_id: number;
  participant_count: number;
  pass_rate: number;
  clinic_rate: number;
  exams: ExamSummaryRow[];
};

type HomeworkItem = { id: number; title: string; status?: string };

async function fetchScoreSummary(sessionId: number): Promise<ScoreSummary | null> {
  try {
    const res = await api.get(`/results/admin/sessions/${sessionId}/score-summary/`);
    return res.data as ScoreSummary;
  } catch {
    return null;
  }
}

async function fetchExamsSummary(sessionId: number): Promise<ExamsSummary | null> {
  try {
    const res = await api.get(`/results/admin/sessions/${sessionId}/exams/summary/`);
    return res.data as ExamsSummary;
  } catch {
    return null;
  }
}

async function fetchHomeworks(sessionId: number): Promise<HomeworkItem[]> {
  try {
    const res = await api.get("/homeworks/", { params: { session_id: sessionId } });
    const arr = res.data?.results ?? res.data?.items ?? res.data ?? [];
    return Array.isArray(arr) ? arr.map((x: any) => ({ id: Number(x.id), title: String(x.title ?? ""), status: x.status })) : [];
  } catch {
    return [];
  }
}

export default function SessionOverviewRoute() {
  const { sessionId, lectureId } = useSessionParams();
  const navigate = useNavigate();
  const sId = Number(sessionId);
  const lecId = Number(lectureId);

  const { data: scoreSummary, isLoading: scoreLoading } = useQuery({
    queryKey: ["session-score-summary", sId],
    queryFn: () => fetchScoreSummary(sId),
    enabled: Number.isFinite(sId),
  });

  const { data: examsSummary, isLoading: examsLoading } = useQuery({
    queryKey: ["session-exams-summary", sId],
    queryFn: () => fetchExamsSummary(sId),
    enabled: Number.isFinite(sId),
  });

  const { data: homeworks = [], isLoading: hwLoading } = useQuery({
    queryKey: ["session-homeworks", sId],
    queryFn: () => fetchHomeworks(sId),
    enabled: Number.isFinite(sId),
  });

  const isLoading = scoreLoading || examsLoading || hwLoading;
  const participantCount = scoreSummary?.participant_count ?? examsSummary?.participant_count ?? 0;
  const examCount = examsSummary?.exams?.length ?? 0;
  const homeworkCount = homeworks.length;

  const base = `/admin/lectures/${lecId}/sessions/${sId}`;

  if (!Number.isFinite(sId)) {
    return (
      <div className="p-4 text-sm text-[var(--color-error)]">
        잘못된 sessionId입니다.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--color-text-muted)]">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        이번 차시 평가 개요
      </h2>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <SummaryCard label="시험 수" value={examCount} />
        <SummaryCard label="과제 수" value={homeworkCount} />
        <SummaryCard label="대상 학생" value={participantCount} />
        {scoreSummary != null && (
          <>
            <SummaryCard label="통과율" value={`${((scoreSummary.pass_rate ?? 0) * 100).toFixed(1)}%`} />
            <SummaryCard label="클리닉 대상" value={`${((scoreSummary.clinic_rate ?? 0) * participantCount).toFixed(0)}명`} />
            <SummaryCard label="평균 점수" value={scoreSummary.avg_score?.toFixed(1) ?? "-"} />
          </>
        )}
      </div>

      {/* 바로가기 */}
      <section className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
          바로가기
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button intent="secondary" size="sm" onClick={() => navigate(`${base}/exams`)}>
            시험 운영
          </Button>
          <Button intent="secondary" size="sm" onClick={() => navigate(`${base}/assignments`)}>
            과제 운영
          </Button>
          <Button intent="secondary" size="sm" onClick={() => navigate(`${base}/scores`)}>
            성적 입력
          </Button>
        </div>
      </section>

      {/* 위험·미완료 항목 (시험/과제 요약) */}
      {(examCount > 0 || homeworkCount > 0) && (
        <section className="rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
            평가 항목 요약
          </h3>
          <ul className="space-y-2 text-sm">
            {(examsSummary?.exams ?? []).map((ex) => (
              <li key={ex.exam_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-2">
                <span className="font-medium text-[var(--color-text-primary)]">[시험] {ex.title}</span>
                <span className="text-[var(--color-text-muted)]">
                  채점 {ex.participant_count} / 합격 {ex.pass_count} / 불합 {ex.fail_count}
                </span>
                <Button intent="ghost" size="sm" onClick={() => navigate(`${base}/exams?examId=${ex.exam_id}`)}>
                  보기
                </Button>
              </li>
            ))}
            {homeworks.map((hw) => (
              <li key={hw.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-2">
                <span className="font-medium text-[var(--color-text-primary)]">[과제] {hw.title}</span>
                <span className="text-[var(--color-text-muted)]">{hw.status ?? "—"}</span>
                <Button intent="ghost" size="sm" onClick={() => navigate(`${base}/assignments?homeworkId=${hw.id}`)}>
                  보기
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {examCount === 0 && homeworkCount === 0 && (
        <EmptyState
          scope="panel"
          tone="empty"
          title="연결된 시험·과제가 없습니다"
          description="시험 탭 또는 과제 탭에서 항목을 추가하세요."
          actions={
            <Button intent="primary" size="sm" onClick={() => navigate(`${base}/exams`)}>
              시험 추가
            </Button>
          }
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-4"
    >
      <div className="text-xs font-medium text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
