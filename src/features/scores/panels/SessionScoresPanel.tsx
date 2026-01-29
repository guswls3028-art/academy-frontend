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
    <section className="card p-4 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-base font-semibold">성적 관리</h3>
          <p className="text-xs text-[var(--text-muted)]">
            세션 등록 학생 기준 성적 입력 및 판정
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-[var(--text-muted)]">성적 불러오는 중...</div>
      )}

      {!isLoading && (isError || !data) && (
        <div className="text-sm text-red-500">성적 로드 실패</div>
      )}

      {!isLoading && !isError && data && (
        <div className="flex gap-4">
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
    </section>
  );
}
