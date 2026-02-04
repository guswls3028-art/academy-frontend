// PATH: src/features/scores/components/ScoresTable.tsx

import { useMemo, useRef, Fragment, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import InlineExamItemsRow from "./InlineExamItemsRow";
import { StatusBadge } from "@/shared/ui/feedback";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import HomeworkQuickInput from "./HomeworkQuickInput";
import { getHomeworkStatus } from "../utils/homeworkStatus";

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

function HomeworkStateBadge({ status }: { status: "UNSET" | "NOT_SUBMITTED" | "ZERO" | "SCORED" }) {
  if (status === "NOT_SUBMITTED") {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
        미제출
      </span>
    );
  }
  if (status === "UNSET") {
    return (
      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600">
        미입력
      </span>
    );
  }
  if (status === "ZERO") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
        0점
      </span>
    );
  }
  return null;
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

  const grid = "grid grid-cols-[200px_180px_120px_240px_120px_120px]";

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
      {rows.map((row) => {
        const selected = selectedEnrollmentId === row.enrollment_id;

        const examEntry =
          row.exams.find((e) => e.exam_id === currentExamId) ??
          row.exams[0];

        const homeworkEntry =
          (currentHomeworkId != null
            ? row.homeworks.find((h) => h.homework_id === currentHomeworkId)
            : row.homeworks[0]) ?? null;

        const hwStatus = getHomeworkStatus({
          score: homeworkEntry?.block?.score,
          metaStatus: homeworkEntry?.block?.meta?.status ?? null,
        });

        const hwLocked = !!homeworkEntry?.block?.is_locked;
        const hwNotSubmitted = hwStatus === "NOT_SUBMITTED";
        const hwDisabled = hwLocked || hwNotSubmitted;

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
                  <div className="flex items-center gap-2">
                    <HomeworkQuickInput
                      ref={(el) => {
                        homeworkInputRefs.current[row.enrollment_id] = el;
                      }}
                      defaultValue={homeworkEntry.block.score}
                      maxScore={homeworkEntry.block.max_score}
                      disabled={hwDisabled}
                      disabledReason={
                        hwLocked
                          ? homeworkEntry.block.lock_reason ?? ""
                          : hwNotSubmitted
                          ? "미제출 처리됨 (/ + Enter 해제는 빈 값 + Enter)"
                          : ""
                      }
                      onSubmitScore={async (score) => {
                        await patchHomeworkQuick({
                          sessionId,
                          enrollmentId: row.enrollment_id,
                          homeworkId: homeworkEntry.homework_id,
                          score,
                          maxScore: homeworkEntry.block.max_score ?? null,
                          metaStatus: null,
                        });
                        qc.invalidateQueries({
                          queryKey: ["session-scores", sessionId],
                        });
                      }}
                      onMarkNotSubmitted={async () => {
                        await patchHomeworkQuick({
                          sessionId,
                          enrollmentId: row.enrollment_id,
                          homeworkId: homeworkEntry.homework_id,
                          score: null,
                          maxScore: homeworkEntry.block.max_score ?? null,
                          metaStatus: "NOT_SUBMITTED",
                        });
                        qc.invalidateQueries({
                          queryKey: ["session-scores", sessionId],
                        });
                      }}
                      onClearStatus={async () => {
                        await patchHomeworkQuick({
                          sessionId,
                          enrollmentId: row.enrollment_id,
                          homeworkId: homeworkEntry.homework_id,
                          score: null,
                          maxScore: homeworkEntry.block.max_score ?? null,
                          metaStatus: null,
                        });
                        qc.invalidateQueries({
                          queryKey: ["session-scores", sessionId],
                        });
                      }}
                    />
                    <HomeworkStateBadge status={hwStatus} />
                  </div>
                ) : (
                  "-"
                )}
              </div>

              <div className={tdBase}>
                {hwStatus === "NOT_SUBMITTED" ? (
                  <StatusBadge status="fail" />
                ) : (
                  <StatusBadge status={toStatus(homeworkEntry?.block?.passed)} />
                )}
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
