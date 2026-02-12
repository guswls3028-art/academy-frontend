// PATH: src/features/scores/panels/SessionScoresPanel.tsx

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchSessionScores,
  type SessionScoreRow,
  type SessionScoreMeta,
} from "../api/sessionScores";

import ScoresTable from "../components/ScoresTable";
import ScoreSidePanel from "./ScoreSidePanel";

export default function SessionScoresPanel({ sessionId }: { sessionId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-scores", sessionId],
    queryFn: () => fetchSessionScores(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });

  const rows = useMemo<SessionScoreRow[]>(() => data?.rows ?? [], [data]);
  const meta: SessionScoreMeta | null = data?.meta ?? null;

  const [selected, setSelected] = useState<SessionScoreRow | null>(null);
  const [currentExamId, setCurrentExamId] = useState<number | null>(null);

  // ✅ 과제 선택
  const [currentHomeworkId, setCurrentHomeworkId] = useState<number | null>(null);

  // ✅ 사이드패널 칩 클릭에 따른 “활성 컬럼”
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
    <div className="flex flex-col gap-[var(--space-6)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-divider)] pb-[var(--space-4)]">
        <div>
          <h3
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-primary)",
            }}
          >
            성적 관리
          </h3>
          <p
            className="mt-1"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              fontWeight: "var(--font-meta)",
            }}
          >
            세션 등록 학생 기준 성적 입력 및 판정 · AI 워커 미작동 시 수동 채점 가능
          </p>
        </div>
      </div>

      {isLoading && (
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            padding: "var(--space-8)",
            textAlign: "center",
          }}
        >
          성적 불러오는 중...
        </div>
      )}

      {!isLoading && (isError || !data) && (
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-error)",
            padding: "var(--space-8)",
            textAlign: "center",
          }}
        >
          성적 로드 실패
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="flex gap-[var(--space-6)]">
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

          {selected && currentExamId && currentHomeworkId && meta && (
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
    </div>
  );
}
