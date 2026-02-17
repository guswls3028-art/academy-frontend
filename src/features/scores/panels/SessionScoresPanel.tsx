// PATH: src/features/scores/panels/SessionScoresPanel.tsx
// 성적 작업공간 — 툴바(전체 N명 · 검색) + 테이블 + 사이드패널, 전역 DS Panel

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchSessionScores,
  type SessionScoreRow,
  type SessionScoreMeta,
} from "../api/sessionScores";

import ScoresTable from "../components/ScoresTable";
import ScoreSidePanel from "./ScoreSidePanel";
import { Panel, EmptyState } from "@/shared/ui/ds";

export default function SessionScoresPanel({ sessionId }: { sessionId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-scores", sessionId],
    queryFn: () => fetchSessionScores(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });

  const allRows = useMemo<SessionScoreRow[]>(() => data?.rows ?? [], [data]);
  const meta: SessionScoreMeta | null = data?.meta ?? null;

  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => (r.student_name ?? "").toLowerCase().includes(q));
  }, [allRows, search]);

  const [selected, setSelected] = useState<SessionScoreRow | null>(null);
  const [currentExamId, setCurrentExamId] = useState<number | null>(null);
  const [currentHomeworkId, setCurrentHomeworkId] = useState<number | null>(null);
  const [activeColumn, setActiveColumn] = useState<"exam" | "homework">("exam");

  useEffect(() => {
    if (!rows.length) {
      setSelected(null);
      setCurrentExamId(null);
      setCurrentHomeworkId(null);
      return;
    }

    if (!selected) {
      const first = rows[0];
      setSelected(first);
      setCurrentExamId(first.exams?.[0]?.exam_id ?? null);
      setCurrentHomeworkId(first.homeworks?.[0]?.homework_id ?? null);
      return;
    }

    const next = rows.find((r) => r.enrollment_id === selected.enrollment_id);
    const resolved = next ?? rows[0];
    setSelected(resolved);

    if (
      currentExamId == null ||
      !resolved.exams.some((e) => e.exam_id === currentExamId)
    ) {
      setCurrentExamId(resolved.exams?.[0]?.exam_id ?? null);
    }

    if (
      currentHomeworkId == null ||
      !resolved.homeworks.some((h) => h.homework_id === currentHomeworkId)
    ) {
      setCurrentHomeworkId(resolved.homeworks?.[0]?.homework_id ?? null);
    }
  }, [rows, selected, currentExamId, currentHomeworkId]);

  return (
    <Panel
      variant="default"
      title="성적 입력"
      description="세션 등록 학생 기준 · 셀 클릭 시 우측에서 상세 입력 (초성 검색 가능)"
    >
      {isLoading && (
        <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />
      )}

      {!isLoading && (isError || !data) && (
        <EmptyState scope="panel" tone="error" title="성적 로드 실패" />
      )}

      {!isLoading && !isError && data && (
        <>
          {/* 작업공간 툴바 */}
          <div
            className="flex flex-wrap items-center gap-3 pb-4"
            style={{ borderBottom: "1px solid var(--color-border-divider)" }}
          >
            <span
              className="text-[15px] font-bold"
              style={{
                color: "var(--color-text-primary)",
                paddingRight: 12,
                borderRight: "1px solid var(--color-border-divider)",
                marginRight: 4,
              }}
            >
              전체 {rows.length}명
            </span>
            <input
              type="search"
              className="ds-input"
              placeholder="이름 검색 (초성 검색 가능)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
              aria-label="학생 이름 검색"
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              scope="panel"
              tone="empty"
              title={search.trim() ? "검색 결과가 없습니다" : "등록된 수강생이 없습니다"}
              description={search.trim() ? "다른 검색어로 시도해 보세요." : "수강생 등록 후 성적을 입력할 수 있습니다."}
            />
          ) : (
            <div className="flex gap-6 mt-4">
              <div className="flex-1 min-w-0">
                <ScoresTable
                  rows={rows}
                  meta={meta}
                  sessionId={sessionId}
                  selectedEnrollmentId={selected?.enrollment_id ?? null}
                  currentExamId={currentExamId}
                  onChangeExam={(id) => {
                    setActiveColumn("exam");
                    setCurrentExamId(id);
                  }}
                  currentHomeworkId={currentHomeworkId}
                  onChangeHomework={(id) => {
                    setActiveColumn("homework");
                    setCurrentHomeworkId(id);
                  }}
                  onSelectRow={setSelected}
                  activeColumn={activeColumn}
                />
              </div>

              {selected && currentExamId != null && currentHomeworkId != null && meta && (
                <div className="w-[420px] shrink-0">
                  <ScoreSidePanel
                    sessionId={sessionId}
                    examId={currentExamId}
                    homeworkId={currentHomeworkId}
                    row={selected}
                    meta={meta}
                    onClose={() => {}}
                    activeColumn={activeColumn}
                    onSelectExam={(id) => {
                      setActiveColumn("exam");
                      setCurrentExamId(id);
                    }}
                    onSelectHomework={(id) => {
                      setActiveColumn("homework");
                      setCurrentHomeworkId(id);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
