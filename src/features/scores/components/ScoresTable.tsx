// PATH: src/features/scores/components/ScoresTable.tsx
/**
 * 성적 탭 메인 테이블 — 동적 컬럼 구조
 *
 * 컬럼: 체크박스 | 이름 | 출석 | {시험1} | {시험2} | ... | {과제1} | {과제2} | ... | 클리닉
 * - 시험/과제: 점수 + 합불 뱃지 + 직접 입력
 * - 커트라인 전수 기반 합불, 하나라도 불합 → 클리닉 대상자
 */

import { useMemo, useRef, Fragment, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type {
  SessionScoreRow,
  SessionScoreMeta,
  SessionScoreExamEntry,
  SessionScoreHomeworkEntry,
} from "../api/sessionScores";
import InlineExamItemsRow from "./InlineExamItemsRow";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import HomeworkQuickInput from "./HomeworkQuickInput";
import { getHomeworkStatus } from "../utils/homeworkStatus";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { TABLE_COL } from "@/shared/ui/domain";
import AttendanceStatusBadge, {
  getAttendanceShortLabel,
  type AttendanceStatus,
} from "@/shared/ui/badges/AttendanceStatusBadge";

const COL_SCORE = 110; // 시험/과제 점수+뱃지 컬럼 너비

/** 합불 뱃지 */
function PassFailBadge({
  passed,
}: {
  passed: boolean | null | undefined;
}) {
  if (passed == null) return null;
  const tone = passed ? "success" : "danger";
  return (
    <span className="ds-status-badge ds-status-badge--1ch" data-tone={tone}>
      {passed ? "합" : "불"}
    </span>
  );
}

/** 진행중/완료 뱃지 (점수 입력 여부 기준) */
function ProgressBadge({
  hasScore,
  isLocked,
}: {
  hasScore: boolean;
  isLocked?: boolean;
}) {
  if (isLocked) {
    return (
      <span className="ds-status-badge" data-tone="neutral">
        처리중
      </span>
    );
  }
  return hasScore ? (
    <span className="ds-status-badge" data-tone="success">
      완료
    </span>
  ) : (
    <span className="ds-status-badge" data-tone="danger">
      진행중
    </span>
  );
}

/** 클리닉 대상자 여부: 시험/과제 중 하나라도 불합 */
function isClinicTarget(row: SessionScoreRow): boolean {
  const examFail = row.exams?.some((e) => e.block.passed === false) ?? false;
  const hwFail =
    row.homeworks?.some((h) => {
      const st = getHomeworkStatus({
        score: h.block.score,
        metaStatus: h.block.meta?.status ?? null,
      });
      return st === "NOT_SUBMITTED" || h.block.passed === false;
    }) ?? false;
  return examFail || hwFail;
}

type Props = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta | null;
  sessionId: number;

  /** enrollment_id -> attendance status (PRESENT, ONLINE, INACTIVE 등) */
  attendanceMap?: Record<number, string>;

  selectedEnrollmentId: number | null;
  selectedExamId: number | null;
  selectedHomeworkId: number | null;
  onSelectCell: (row: SessionScoreRow, type: "exam" | "homework", id: number) => void;
  onSelectRow: (row: SessionScoreRow) => void;
};

export default function ScoresTable({
  rows,
  meta,
  sessionId,
  attendanceMap = {},
  selectedEnrollmentId,
  selectedExamId,
  selectedHomeworkId,
  onSelectCell,
  onSelectRow,
}: Props) {
  const qc = useQueryClient();
  const homeworkInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const examOptions = meta?.exams ?? [];
  const homeworkOptions = meta?.homeworks ?? [];

  const dynamicCols = useMemo(() => {
    const examCols = examOptions.map((e) => ({ type: "exam" as const, id: e.exam_id, title: e.title }));
    const hwCols = homeworkOptions.map((h) => ({
      type: "homework" as const,
      id: h.homework_id,
      title: h.title,
    }));
    return [...examCols, ...hwCols];
  }, [examOptions, homeworkOptions]);

  const gridTemplateColumns = useMemo(() => {
    const fixed = `${TABLE_COL.checkbox}px ${TABLE_COL.name}px ${TABLE_COL.statusBadge}px`;
    const dynamic = dynamicCols.map(() => `${COL_SCORE}px`).join(" ");
    const clinic = `${TABLE_COL.statusBadge}px`;
    return `${fixed} ${dynamic} ${clinic}`;
  }, [dynamicCols]);

  const thBase =
    "px-2 py-3 text-xs font-semibold text-[var(--text-secondary)] tracking-tight truncate";
  const tdBase = "px-2 py-2 text-sm text-[var(--text-primary)]";

  const focusHomeworkInput = (enrollmentId: number, homeworkId: number) => {
    homeworkInputRefs.current[`${enrollmentId}-${homeworkId}`]?.focus();
  };

  return (
    <div
      className="ds-table-wrap overflow-x-auto"
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
        overflow: "hidden",
      }}
      tabIndex={0}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          minWidth: "max-content",
        }}
      >
        {/* HEADER */}
        <div
          className={`${thBase} border-b border-[var(--color-border-divider)]`}
          style={{
            background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
          }}
        >
          {" "}
        </div>
        <div
          className={`${thBase} border-b border-[var(--color-border-divider)]`}
          style={{
            background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
          }}
        >
          이름
        </div>
        <div
          className={`${thBase} border-b border-[var(--color-border-divider)]`}
          style={{
            background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
          }}
        >
          출석
        </div>
        {dynamicCols.map((col) => (
          <div
            key={`${col.type}-${col.id}`}
            className={`${thBase} border-b border-[var(--color-border-divider)]`}
            style={{
              background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
              writingMode: "horizontal-tb",
            }}
            title={col.title}
          >
            {col.title}
          </div>
        ))}
        <div
          className={`${thBase} border-b border-[var(--color-border-divider)]`}
          style={{
            background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
          }}
        >
          클리닉
        </div>
      </div>

      {/* BODY */}
      {rows.map((row) => {
        const selected = selectedEnrollmentId === row.enrollment_id;
        const clinicTarget = isClinicTarget(row);

        return (
          <Fragment key={row.enrollment_id}>
            <div
              className={[
                "border-b border-[var(--color-border-divider)] transition-colors",
                selected
                  ? "bg-[color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))]"
                  : "hover:bg-[var(--bg-surface-soft)]",
              ].join(" ")}
              style={{
                display: "grid",
                gridTemplateColumns,
                minWidth: "max-content",
              }}
            >
              {/* 체크박스 (placeholder) */}
              <div
                className={`${tdBase} flex items-center`}
                onClick={() => onSelectRow(row)}
              >
                <span className="w-4" />
              </div>

              {/* 이름 */}
              <div
                className={`${tdBase} font-semibold min-w-0 cursor-pointer`}
                onClick={() => onSelectRow(row)}
              >
                <StudentNameWithLectureChip
                  name={row.student_name ?? ""}
                  profilePhotoUrl={row.profile_photo_url ?? undefined}
                  avatarSize={24}
                  lectures={
                    row.lecture_title
                      ? [{ lectureName: row.lecture_title, color: row.lecture_color }]
                      : undefined
                  }
                  chipSize={14}
                />
              </div>

              {/* 출석 */}
              <div
                className={`${tdBase} flex items-center cursor-pointer`}
                onClick={() => onSelectRow(row)}
              >
                {(() => {
                  const status = attendanceMap[row.enrollment_id];
                  if (!status) return <span className="text-[var(--text-muted)]">-</span>;
                  return (
                    <AttendanceStatusBadge
                      status={status as AttendanceStatus}
                      variant="2ch"
                    />
                  );
                })()}
              </div>

              {/* 시험 컬럼들 */}
              {examOptions.map((ex) => {
                const entry = row.exams?.find((e) => e.exam_id === ex.exam_id) ?? null;
                const block = entry?.block;
                const isSelected =
                  selected &&
                  selectedExamId === ex.exam_id &&
                  selectedHomeworkId == null;
                const hasScore = block?.score != null && !block?.is_locked;
                const scoreText =
                  block?.score == null
                    ? "-"
                    : block?.max_score != null && block.max_score > 0
                      ? `${Math.round(block.score)}/${Math.round(block.max_score)}`
                      : `${Math.round(block!.score)}점`;

                return (
                  <div
                    key={`exam-${ex.exam_id}`}
                    className={`${tdBase} flex flex-col gap-1 cursor-pointer min-w-0 ${
                      isSelected
                        ? "ring-1 ring-[var(--color-primary)] rounded"
                        : ""
                    }`}
                    style={{ padding: 6 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCell(row, "exam", ex.exam_id);
                    }}
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-medium">{scoreText}</span>
                      <PassFailBadge passed={block?.passed} />
                    </div>
                    <ProgressBadge
                      hasScore={!!hasScore}
                      isLocked={block?.is_locked}
                    />
                  </div>
                );
              })}

              {/* 과제 컬럼들 */}
              {homeworkOptions.map((hw) => {
                const entry =
                  row.homeworks?.find((h) => h.homework_id === hw.homework_id) ??
                  null;
                const block = entry?.block;
                const isSelected =
                  selected && selectedHomeworkId === hw.homework_id;
                const hwStatus = getHomeworkStatus({
                  score: block?.score,
                  metaStatus: block?.meta?.status ?? null,
                });

                return (
                  <div
                    key={`hw-${hw.homework_id}`}
                    className={`${tdBase} flex flex-col gap-1 min-w-0 ${
                      isSelected
                        ? "ring-1 ring-[var(--color-primary)] rounded"
                        : ""
                    }`}
                    style={{ padding: 6 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCell(row, "homework", hw.homework_id);
                    }}
                  >
                    <div
                      className="flex items-center gap-2 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {entry ? (
                        <>
                          <HomeworkQuickInput
                            ref={(el) => {
                              homeworkInputRefs.current[
                                `${row.enrollment_id}-${hw.homework_id}`
                              ] = el;
                            }}
                            defaultValue={block?.score ?? null}
                            maxScore={block?.max_score ?? null}
                            onSubmitScore={async (score) => {
                              await patchHomeworkQuick({
                                sessionId,
                                enrollmentId: row.enrollment_id,
                                homeworkId: hw.homework_id,
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
                                homeworkId: hw.homework_id,
                                score: null,
                                metaStatus: "NOT_SUBMITTED",
                              });
                              qc.invalidateQueries({
                                queryKey: ["session-scores", sessionId],
                              });
                            }}
                          />
                          <PassFailBadge passed={block?.passed} />
                        </>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </div>
                    {entry && (
                      <ProgressBadge
                        hasScore={hwStatus === "SCORED" || hwStatus === "ZERO"}
                        isLocked={block?.is_locked}
                      />
                    )}
                  </div>
                );
              })}

              {/* 클리닉 */}
              <div
                className={`${tdBase} flex items-center cursor-pointer`}
                onClick={() => onSelectRow(row)}
              >
                {clinicTarget ? (
                  <span
                    className="ds-status-badge"
                    data-tone="danger"
                    title="하나라도 불합으로 클리닉 대상"
                  >
                    대상
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">-</span>
                )}
              </div>
            </div>

            {/* 시험 문항별 주관식 입력 확장행 (클릭 시 해당 시험의 문항별 수기 입력) */}
            {selected &&
              selectedExamId != null &&
              row.enrollment_id === selectedEnrollmentId && (
                <div
                  className="col-span-full border-b border-[var(--color-border-divider)]"
                  style={{
                    gridColumn: "1 / -1",
                    background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
                    padding: "var(--space-4)",
                  }}
                >
                  <InlineExamItemsRow
                    examId={selectedExamId}
                    enrollmentId={row.enrollment_id}
                    variant="block"
                  />
                </div>
              )}
          </Fragment>
        );
      })}
    </div>
  );
}
