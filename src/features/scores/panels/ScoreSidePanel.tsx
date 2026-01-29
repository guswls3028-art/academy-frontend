// PATH: src/features/scores/panels/ScoreSidePanel.tsx

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import ExamStatusChip from "../components/ExamStatusChip";

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
    .filter((h) => h.block.passed === false)
    .map((h) => h.title);

  return [...failedExams, ...failedHomework];
}

function reasonType(row: SessionScoreRow) {
  const examFail = row.exams.some((e) => e.block.passed === false);
  const hwFail = row.homeworks.some((h) => h.block.passed === false);

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

  return (
    <div className="card h-full p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-4 border-b pb-3">
        <div className="text-xs text-muted">enrollment #{row.enrollment_id}</div>
        <div className="text-lg font-semibold">{row.student_name}</div>
      </div>

      {/* 시험 */}
      <div className="mb-4">
        <div className="mb-1 text-xs font-semibold text-muted">시험</div>
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
        <div className="mb-1 text-xs font-semibold text-muted">과제</div>
        <div className="flex flex-wrap gap-1">
          {homeworks.map((h) => (
            <ExamStatusChip
              key={h.homework_id}
              label={h.title}
              passed={h.block.passed}
              onClick={() => onSelectHomework?.(h.homework_id)}
              active={activeColumn === "homework" && h.homework_id === homeworkId}
            />
          ))}
        </div>
      </div>

      <div className="my-4 border-t" />

      {/* 판정 */}
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted">판정</span>
        <span className="font-semibold">
          {passed == null ? "-" : passed ? "PASS" : "FAIL"}
        </span>
      </div>

      {/* 사유 */}
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted">사유</span>
        <span className="font-medium">{reasonType(row)}</span>
      </div>

      {/* 사유상세 */}
      <div className="mt-3">
        <div className="mb-1 text-xs font-semibold text-muted">사유상세</div>

        {reasons.length === 0 ? (
          <div className="text-xs text-muted">-</div>
        ) : (
          <ul className="list-disc pl-4 text-sm">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
