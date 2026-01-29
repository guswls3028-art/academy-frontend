// PATH: src/features/scores/components/ScoresTable.tsx

import { useMemo, useRef, Fragment, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import QuickScoreInput from "./QuickScoreInput";
import InlineExamItemsRow from "./InlineExamItemsRow";
import { StatusBadge } from "@/shared/ui/feedback";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";

function clinicText(row: SessionScoreRow, currentHomeworkId: number | null) {
  const examRequired = !!row.exams?.[0]?.block?.clinic_required;

  const hwEntry =
    (currentHomeworkId != null
      ? row.homeworks?.find((h) => h.homework_id === currentHomeworkId)
      : row.homeworks?.[0]) ?? null;

  const hwRequired = !!hwEntry?.block?.clinic_required;

  if (examRequired && hwRequired) return "시험 + 과제";
  if (examRequired) return "시험";
  if (hwRequired) return "과제";
  return "-";
}

function toStatus(passed: boolean | null | undefined) {
  if (passed == null) return "pending";
  return passed ? "pass" : "fail";
}

type Props = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta | null;
  sessionId: number;

  selectedEnrollmentId: number | null;

  currentExamId: number | null;
  onChangeExam: (examId: number) => void;

  currentHomeworkId: number | null;
  onChangeHomework: (homeworkId: number) => void;

  onSelectRow: (row: SessionScoreRow) => void;

  activeColumn?: "exam" | "homework";
};

export default function ScoresTable({
  rows,
  meta,
  sessionId,
  selectedEnrollmentId,
  currentExamId,
  onChangeExam,
  currentHomeworkId,
  onChangeHomework,
  onSelectRow,
  activeColumn = "exam",
}: Props) {
  const qc = useQueryClient();
  const homeworkInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const selectedIndex = useMemo(() => {
    if (selectedEnrollmentId == null) return -1;
    return rows.findIndex((r) => r.enrollment_id === selectedEnrollmentId);
  }, [rows, selectedEnrollmentId]);

  const examOptions = meta?.exams ?? [];
  const homeworkOptions = meta?.homeworks ?? [];

  const focusHomeworkInput = (enrollmentId: number) => {
    homeworkInputRefs.current[enrollmentId]?.focus();
  };

  const moveSelection = (nextIndex: number) => {
    const row = rows[nextIndex];
    if (row) onSelectRow(row);
  };

  useEffect(() => {
    if (activeColumn !== "homework") return;
    if (selectedEnrollmentId == null) return;
    focusHomeworkInput(selectedEnrollmentId);
  }, [activeColumn, selectedEnrollmentId]);

  /** ✅ 컬럼 레이아웃 고정 (헤더/바디 완전 일치) */
  const grid =
    "grid grid-cols-[200px_180px_120px_240px_120px_120px]";

  const thBase =
    "px-3 py-3 text-sm font-semibold text-[var(--text-secondary)] tracking-tight";

  const tdBase =
    "px-3 py-3 text-base text-[var(--text-primary)]";

  const thActive =
    "bg-[var(--color-primary-soft)] border-b-2 border-[var(--color-primary)]";

  return (
    <div
      className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)]"
      tabIndex={0}
      onKeyDown={(e) => {
        if (rows.length === 0) return;

        const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;

        if (e.key === "ArrowUp") {
          e.preventDefault();
          moveSelection(Math.max(0, baseIndex - 1));
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveSelection(Math.min(rows.length - 1, baseIndex + 1));
        }

        if (e.key === "Enter") {
          e.preventDefault();
          const row = rows[baseIndex];
          if (row) focusHomeworkInput(row.enrollment_id);
        }
      }}
    >
      {/* ================= HEADER ================= */}
      <div className={`border-b ${grid}`}>
        <div className={thBase}>학생</div>

        <div
          className={[
            thBase,
            activeColumn === "exam" ? thActive : "",
          ].join(" ")}
        >
          시험
          {examOptions.length > 1 && (
            <select
              className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-sm font-medium text-black shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]"
              value={currentExamId ?? ""}
              onChange={(e) => onChangeExam(Number(e.target.value))}
            >
              {examOptions.map((e) => (
                <option key={e.exam_id} value={e.exam_id}>
                  {e.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={thBase}>판정</div>

        <div
          className={[
            thBase,
            activeColumn === "homework" ? thActive : "",
          ].join(" ")}
        >
          과제
          {homeworkOptions.length > 1 && (
            <select
              className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-white px-2 py-1 text-sm font-medium text-black shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]"
              value={currentHomeworkId ?? ""}
              onChange={(e) => onChangeHomework(Number(e.target.value))}
            >
              {homeworkOptions.map((h) => (
                <option key={h.homework_id} value={h.homework_id}>
                  {h.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={thBase}>판정</div>
        <div className={thBase}>클리닉</div>
      </div>

      {/* ================= BODY ================= */}
      {rows.map((row, idx) => {
        const selected = selectedEnrollmentId === row.enrollment_id;

        const examEntry =
          row.exams.find((e) => e.exam_id === currentExamId) ??
          row.exams[0];

        const homeworkEntry =
          (currentHomeworkId != null
            ? row.homeworks.find((h) => h.homework_id === currentHomeworkId)
            : row.homeworks[0]) ?? null;

        return (
          <Fragment key={row.enrollment_id}>
            <div
              className={[
                grid,
                "border-b cursor-pointer",
                selected
                  ? "bg-[var(--color-primary-soft)]"
                  : "hover:bg-[var(--bg-surface-soft)]",
              ].join(" ")}
              onClick={() => onSelectRow(row)}
            >
              <div className={`${tdBase} font-semibold`}>
                {row.student_name}
              </div>

              <div className={tdBase}>
                {examEntry?.block?.score == null
                  ? "-"
                  : examEntry.block.max_score == null
                  ? examEntry.block.score
                  : `${examEntry.block.score}/${examEntry.block.max_score}`}
              </div>

              <div className={tdBase}>
                <StatusBadge status={toStatus(examEntry?.block?.passed)} />
              </div>

              <div className={tdBase}>
                {homeworkEntry ? (
                  <QuickScoreInput
                    ref={(el) => {
                      homeworkInputRefs.current[row.enrollment_id] = el;
                    }}
                    defaultValue={homeworkEntry.block.score}
                    maxScore={homeworkEntry.block.max_score}
                    disabled={!!homeworkEntry.block.is_locked}
                    disabledReason={homeworkEntry.block.lock_reason ?? ""}
                    onSubmit={async (score) => {
                      await patchHomeworkQuick({
                        sessionId,
                        enrollmentId: row.enrollment_id,
                        homeworkId: homeworkEntry.homework_id,
                        score,
                        maxScore: homeworkEntry.block.max_score ?? null,
                      });
                      qc.invalidateQueries({
                        queryKey: ["session-scores", sessionId],
                      });
                    }}
                  />
                ) : (
                  "-"
                )}
              </div>

              <div className={tdBase}>
                <StatusBadge
                  status={toStatus(homeworkEntry?.block?.passed)}
                />
              </div>

              <div className={`${tdBase} text-sm text-[var(--text-secondary)]`}>
                {clinicText(row, currentHomeworkId)}
              </div>
            </div>

            {selected && examEntry?.exam_id && (
              <InlineExamItemsRow
                examId={examEntry.exam_id}
                enrollmentId={row.enrollment_id}
                colSpan={6}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
