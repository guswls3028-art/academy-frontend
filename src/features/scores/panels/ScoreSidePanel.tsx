// PATH: src/features/scores/panels/ScoreSidePanel.tsx

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import ExamStatusChip from "../components/ExamStatusChip";
import { getHomeworkStatus } from "../utils/homeworkStatus";

type Props = {
  sessionId: number;
  examId: number;
  row: SessionScoreRow;
  meta: SessionScoreMeta;
  onClose: () => void;

  activeColumn?: "exam" | "homework";
  onSelectExam?: (examId: number) => void;

  // ✅ 과제 선택
  homeworkId: number;
  onSelectHomework?: (homeworkId: number) => void;
};

function overallPassed(row: SessionScoreRow): boolean | null {
  const examResults = row.exams.map((e) => e.block.passed);
  const hwResults = row.homeworks.map((h) => h.block.passed);

  if ([...examResults, ...hwResults].some((v) => v == null)) return null;
  return [...examResults, ...hwResults].every((v) => v === true);
}

function failReasons(row: SessionScoreRow) {
  const failedExams = row.exams
    .filter((e) => e.block.passed === false)
    .map((e) => e.title);

  const failedHomework = row.homeworks
    .filter((h) => {
      const st = getHomeworkStatus({
        score: h.block.score,
        metaStatus: h.block.meta?.status ?? null,
      });
      return st === "NOT_SUBMITTED" || h.block.passed === false;
    })
    .map((h) => h.title);

  return [...failedExams, ...failedHomework];
}

function reasonType(row: SessionScoreRow) {
  const examFail = row.exams.some((e) => e.block.passed === false);
  const hwFail = row.homeworks.some((h) => {
    const st = getHomeworkStatus({
      score: h.block.score,
      metaStatus: h.block.meta?.status ?? null,
    });
    return st === "NOT_SUBMITTED" || h.block.passed === false;
  });

  if (examFail && hwFail) return "시험 + 과제";
  if (examFail) return "시험";
  if (hwFail) return "과제";
  return "-";
}

export default function ScoreSidePanel({
  row,
  meta,
  examId,
  homeworkId,
  activeColumn = "exam",
  onSelectExam,
  onSelectHomework,
}: Props) {
  const exams = row.exams ?? [];
  const homeworks = row.homeworks ?? [];
  const passed = overallPassed(row);
  const reasons = failReasons(row);

  const currentExam = exams.find((e) => e.exam_id === examId);
  const currentHomework = homeworks.find((h) => h.homework_id === homeworkId);

  const activeEntry = activeColumn === "exam" ? currentExam : currentHomework;
  const activePassed =
    activeColumn === "exam" ? currentExam?.block?.passed : currentHomework?.block?.passed;
  const activeScore =
    activeColumn === "exam"
      ? currentExam?.block?.score
      : currentHomework?.block?.score;
  const activeMax =
    activeColumn === "exam"
      ? currentExam?.block?.max_score
      : currentHomework?.block?.max_score;
  const activeTitle =
    activeColumn === "exam" ? currentExam?.title : currentHomework?.title;

  return (
    <div className="card h-full p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-4 border-b pb-3">
        <div className="text-xs text-[var(--text-muted)]">enrollment #{row.enrollment_id}</div>
        <div className="text-lg font-semibold">{row.student_name}</div>
      </div>

      {/* 현재 선택: 점수입력/통과·미통과 */}
      {activeEntry && (
        <div className="mb-4 p-3 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)]">
          <div className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
            {activeTitle}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-[var(--text-muted)]">점수</span>
            <span className="font-medium">
              {activeScore != null && activeMax != null && activeMax > 0
                ? `${Math.round(activeScore)}/${Math.round(activeMax)}`
                : activeScore != null
                  ? `${Math.round(activeScore)}점`
                  : "미입력"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-muted)]">판정</span>
            {activePassed != null ? (
              <span
                className="ds-status-badge"
                data-tone={activePassed ? "success" : "danger"}
              >
                {activePassed ? "통과" : "미통과"}
              </span>
            ) : (
              <span className="text-sm text-[var(--text-muted)]">-</span>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {activeColumn === "exam"
              ? "시험: 객관식은 AI OMR 자동반영, 주관식은 테이블에서 해당 셀 클릭 시 문항별 입력"
              : "과제: 테이블 셀에서 직접 점수 입력"}
          </p>
        </div>
      )}

      {/* 시험 */}
      <div className="mb-4">
        <div className="mb-1 text-xs font-semibold text-[var(--text-muted)]">시험</div>
        <div className="flex flex-wrap gap-1">
          {exams.map((e) => (
            <ExamStatusChip
              key={e.exam_id}
              label={e.title}
              passed={e.block.passed}
              onClick={() => onSelectExam?.(e.exam_id)}
              active={activeColumn === "exam" && e.exam_id === examId}
            />
          ))}
        </div>
      </div>

      {/* 과제 (다건) */}
      <div className="mb-4">
        <div className="mb-1 text-xs font-semibold text-[var(--text-muted)]">과제</div>
        <div className="flex flex-wrap gap-1">
          {homeworks.map((h) => {
            const st = getHomeworkStatus({
              score: h.block.score,
              metaStatus: h.block.meta?.status ?? null,
            });

            const chipPassed =
              st === "NOT_SUBMITTED" ? false : h.block.passed;

            const label = st === "NOT_SUBMITTED" ? `${h.title} (미제출)` : h.title;

            return (
              <ExamStatusChip
                key={h.homework_id}
                label={label}
                passed={chipPassed}
                onClick={() => onSelectHomework?.(h.homework_id)}
                active={activeColumn === "homework" && h.homework_id === homeworkId}
              />
            );
          })}
        </div>
      </div>

      <div className="my-4 border-t" />

      {/* 종합 판정 */}
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-[var(--text-muted)]">종합 판정</span>
        <span className="font-semibold">
          {passed == null ? "-" : passed ? "PASS" : "FAIL"}
        </span>
      </div>

      <div className="mb-2 flex justify-between text-sm">
        <span className="text-[var(--text-muted)]">사유</span>
        <span className="font-medium">{reasonType(row)}</span>
      </div>

      {/* 사유상세 */}
      <div className="mt-3">
        <div className="mb-1 text-xs font-semibold text-[var(--text-muted)]">사유상세</div>

        {reasons.length === 0 ? (
          <div className="text-xs text-[var(--text-muted)]">-</div>
        ) : (
          <ul className="list-disc pl-4 text-sm">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {/* 클리닉 대상자 안내 */}
      {(passed === false) && (
        <div className="mt-4 p-2 rounded text-sm bg-[color-mix(in srgb,var(--color-danger) 10%,transparent)] text-[var(--color-danger)]">
          하나라도 불합 → 클리닉 대상자
        </div>
      )}
    </div>
  );
}
