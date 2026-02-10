// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * ✅ SessionScoresEntryPage (ENTRY PAGE)
 *
 * 책임:
 * - sessionId 라우팅 파싱
 * - 세션 단위 시험 요약 표시 (viewer)
 * - 실제 성적 테이블은 scores 도메인에 위임
 *
 * ❌ 학생별 점수 렌더 ❌
 * ❌ mock 데이터 ❌
 * ❌ 점수 입력 ❌
 */

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import SessionScoresPanel from "@/features/scores/panels/SessionScoresPanel";
import { PageHeader, Section, Panel, EmptyState } from "@/shared/ui/ds";

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

// ------------------------------------------------------------
// API (viewer only)
// ------------------------------------------------------------

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
    <Section>
      <PageHeader
        title="세션 성적"
        description="세션 시험 요약과 성적 패널을 확인합니다."
        actions={null}
      />

      <Panel>
        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : isError ? (
          <EmptyState scope="panel" tone="error" title="성적 요약을 불러올 수 없습니다." />
        ) : !data ? (
          <EmptyState scope="panel" title="표시할 데이터가 없습니다." />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {/* ===================== */}
            {/* Session Exam Summary */}
            {/* ===================== */}
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
                  세션 시험 요약
                </div>
                <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
                  {data.exams?.length ?? 0}개
                </div>
              </div>

              {data.exams && data.exams.length > 0 ? (
                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid var(--color-border-divider)",
                    background: "var(--color-bg-surface)",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {data.exams.map((exam) => (
                      <div
                        key={exam.exam_id}
                        style={{
                          borderRadius: 14,
                          border: "1px solid var(--color-border-divider)",
                          background: "var(--color-bg-surface-soft)",
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 950,
                            color: "var(--color-text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {exam.title}
                        </div>

                        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
                            평균 <span style={{ fontWeight: 950, color: "var(--color-text-secondary)" }}>{exam.avg_score}</span>
                          </span>

                          <span style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>·</span>

                          <span style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
                            합격률{" "}
                            <span style={{ fontWeight: 950, color: "var(--color-text-secondary)" }}>
                              {exam.pass_rate}%
                            </span>
                          </span>

                          <span style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>·</span>

                          <span style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
                            기준{" "}
                            <span style={{ fontWeight: 950, color: "var(--color-text-secondary)" }}>
                              {exam.pass_score}
                            </span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  scope="panel"
                  mode="embedded"
                  title="이 세션에는 성적 대상 시험이 없습니다."
                />
              )}
            </div>

            {/* ===================== */}
            {/* Scores Domain Entry */}
            {/* ===================== */}
            <SessionScoresPanel sessionId={numericSessionId} />
          </div>
        )}
      </Panel>
    </Section>
  );
}
