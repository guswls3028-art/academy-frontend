// PATH: src/features/scores/components/ScoresTable.tsx

import { useMemo, useRef, Fragment, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import InlineExamItemsRow from "./InlineExamItemsRow";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import HomeworkQuickInput from "./HomeworkQuickInput";
import { getHomeworkStatus } from "../utils/homeworkStatus";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";

/* ===============================
   Status 표시 (LOCAL / SSOT)
   - Status System: success / warning / error / info
   - 공용 컴포넌트 ❌
================================ */

function StatusCell({ status }: { status: "success" | "error" | "info" }) {
  return (
    <span
      className={[
        "inline-flex rounded px-2 py-0.5 text-xs font-semibold",
        status === "success" && "status-success",
        status === "error" && "status-error",
        status === "info" && "status-info",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {status === "success"
        ? "PASS"
        : status === "error"
        ? "FAIL"
        : "-"}
    </span>
  );
}

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
  if (passed == null) return "info";
  return passed ? "success" : "error";
}

function HomeworkStateBadge({
  status,
}: {
  status: "UNSET" | "NOT_SUBMITTED" | "ZERO" | "SCORED";
}) {
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
      className="ds-table-wrap"
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
        overflow: "hidden",
      }}
      tabIndex={0}
    >
      {/* HEADER */}
      <div
        className={`${grid} border-b border-[var(--color-border-divider)]`}
        style={{
          background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
        }}
      >
        <div className={thBase}>학생</div>
        <div className={[thBase, activeColumn === "exam" ? thActive : ""].join(" ")}>
          시험
        </div>
        <div className={thBase}>판정</div>
        <div className={[thBase, activeColumn === "homework" ? thActive : ""].join(" ")}>
          과제
        </div>
        <div className={thBase}>판정</div>
        <div className={thBase}>클리닉</div>
      </div>

      {/* BODY */}
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

        return (
          <Fragment key={row.enrollment_id}>
            <div
              className={[
                grid,
                "border-b border-[var(--color-border-divider)] cursor-pointer transition-colors",
                selected
                  ? "bg-[color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))]"
                  : "hover:bg-[var(--bg-surface-soft)]",
              ].join(" ")}
              onClick={() => onSelectRow(row)}
              style={{
                borderBottomColor: "color-mix(in srgb, var(--color-border-divider) 35%, transparent)",
              }}
            >
              <div className={`${tdBase} font-semibold min-w-0`}>
                <StudentNameWithLectureChip
                  name={row.student_name ?? ""}
                  lectures={
                    row.lecture_title
                      ? [{ lectureName: row.lecture_title, color: row.lecture_color }]
                      : undefined
                  }
                  chipSize={14}
                />
              </div>

              <div className={tdBase}>
                {examEntry?.block?.score == null
                  ? "-"
                  : examEntry.block.max_score == null
                  ? examEntry.block.score
                  : `${examEntry.block.score}/${examEntry.block.max_score}`}
              </div>

              <div className={tdBase}>
                <StatusCell status={toStatus(examEntry?.block?.passed)} />
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
                      onSubmitScore={async (score) => {
                        await patchHomeworkQuick({
                          sessionId,
                          enrollmentId: row.enrollment_id,
                          homeworkId: homeworkEntry.homework_id,
                          score,
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
                          metaStatus: "NOT_SUBMITTED",
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
                <StatusCell status={toStatus(homeworkEntry?.block?.passed)} />
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
