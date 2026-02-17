// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * ✅ SessionScoresEntryPage — 성적 작업공간 (워크플레이스)
 *
 * - 작업공간 톤: 요약 툴바 · 시험 요약 카드 · 성적 입력 테이블
 * - 전역 DS 유지 (Panel, EmptyState, domain 톤)
 */

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import SessionScoresPanel from "@/features/scores/panels/SessionScoresPanel";
import { Panel, EmptyState } from "@/shared/ui/ds";

// ------------------------------------------------------------
// Types (요약용)
// ------------------------------------------------------------

type SessionExamSummary = {
  exam_id: number;
  title: string;
  pass_score: number;
  participant_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
};

type SessionExamsSummaryResponse = {
  session_id: number;
  participant_count: number;
  pass_rate: number;
  clinic_rate: number;
  strategy: string;
  pass_source: string;
  exams: SessionExamSummary[];
};

async function fetchSessionExamsSummary(sessionId: number): Promise<SessionExamsSummaryResponse> {
  const res = await api.get(`/results/admin/sessions/${sessionId}/exams/summary/`);
  return res.data;
}

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

export default function SessionScoresEntryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const numericSessionId = Number(sessionId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-exams-summary", numericSessionId],
    queryFn: () => fetchSessionExamsSummary(numericSessionId),
    enabled: Number.isFinite(numericSessionId),
  });

  if (!Number.isFinite(numericSessionId)) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-error)" }}>
        유효하지 않은 sessionId 입니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 작업공간 상단 요약 툴바 */}
      <div
        className="flex flex-wrap items-center gap-4 py-3"
        style={{
          borderBottom: "1px solid var(--color-border-divider)",
          paddingLeft: 0,
          paddingRight: 0,
        }}
      >
        {!isLoading && !isError && data && (
          <>
            <span
              className="text-[var(--text-sm)] font-semibold"
              style={{ color: "var(--color-text-secondary)" }}
            >
              전체 <strong style={{ color: "var(--color-text-primary)" }}>{data.participant_count ?? 0}</strong>명
            </span>
            <span style={{ color: "var(--color-border-divider)" }}>|</span>
            <span
              className="text-[var(--text-sm)] font-semibold"
              style={{ color: "var(--color-text-secondary)" }}
            >
              시험 <strong style={{ color: "var(--color-text-primary)" }}>{data.exams?.length ?? 0}</strong>건
            </span>
          </>
        )}
      </div>

      {isLoading ? (
        <Panel>
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        </Panel>
      ) : isError ? (
        <Panel>
          <EmptyState scope="panel" tone="error" title="성적 요약을 불러올 수 없습니다." />
        </Panel>
      ) : !data ? (
        <Panel>
          <EmptyState scope="panel" title="표시할 데이터가 없습니다." />
        </Panel>
      ) : (
        <>
          {/* 시험 요약 카드 — 작업공간 블록 */}
          {data.exams && data.exams.length > 0 && (
            <Panel
              variant="subtle"
              title="시험 요약"
              description={`${data.exams.length}건 · 평균·합격률 기준`}
            >
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                }}
              >
                {data.exams.map((exam) => (
                  <div
                    key={exam.exam_id}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: "var(--color-border-divider)",
                      background: "var(--color-bg-surface)",
                    }}
                  >
                    <div
                      className="truncate text-[var(--text-sm)] font-semibold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {exam.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--color-text-muted)]">
                      <span>평균 <strong className="text-[var(--color-text-secondary)]">{exam.avg_score}</strong></span>
                      <span>·</span>
                      <span>합격률 <strong className="text-[var(--color-text-secondary)]">{exam.pass_rate}%</strong></span>
                      <span>·</span>
                      <span>기준 <strong className="text-[var(--color-text-secondary)]">{exam.pass_score}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {data.exams?.length === 0 && (
            <Panel variant="subtle">
              <EmptyState
                scope="panel"
                tone="empty"
                title="이 세션에는 성적 대상 시험이 없습니다."
                description="시험 탭에서 시험을 연결하면 여기서 성적을 관리할 수 있습니다."
              />
            </Panel>
          )}

          {/* 성적 입력 작업공간 */}
          <SessionScoresPanel sessionId={numericSessionId} />
        </>
      )}
    </div>
  );
}
