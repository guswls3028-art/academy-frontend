// PATH: src/features/scores/components/ScoresTable.tsx
/**
 * 성적 탭 메인 테이블 — 동적 컬럼 구조
 * 디자인 SSOT: 학생(students) 도메인과 동일 — DomainTable + ds-table--flat
 *
 * 컬럼: 체크박스 | 이름 | 출석 | {시험1} | ... | {과제1} | ... | 클리닉
 * - 시험/과제: 점수 + 합불 뱃지 + 직접 입력
 * - 커트라인 전수 기반 합불, 하나라도 불합 → 클리닉 대상자
 */

import { useMemo, useRef, useEffect, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import InlineExamItemsRow from "./InlineExamItemsRow";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import HomeworkQuickInput from "./HomeworkQuickInput";
import { getHomeworkStatus } from "../utils/homeworkStatus";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { DomainTable, TABLE_COL } from "@/shared/ui/domain";
import AttendanceStatusBadge, {
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

  /** 키보드로 과제 셀에 포커스 이동 시 해당 입력란에 포커스 */
  focusHomeworkCell?: { enrollmentId: number; homeworkId: number } | null;
  onFocusHomeworkDone?: () => void;
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
  focusHomeworkCell,
  onFocusHomeworkDone,
}: Props) {
  const qc = useQueryClient();
  const homeworkInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!focusHomeworkCell || !onFocusHomeworkDone) return;
    const key = `${focusHomeworkCell.enrollmentId}-${focusHomeworkCell.homeworkId}`;
    const el = homeworkInputRefs.current[key];
    if (el) {
      el.focus();
      onFocusHomeworkDone();
    } else {
      onFocusHomeworkDone();
    }
  }, [focusHomeworkCell, onFocusHomeworkDone]);

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

  const tableWidth = useMemo(
    () =>
      TABLE_COL.checkbox +
      TABLE_COL.name +
      TABLE_COL.statusBadge +
      dynamicCols.length * COL_SCORE +
      TABLE_COL.statusBadge,
    [dynamicCols.length]
  );

  const colWidths = useMemo(() => {
    const fixed = [TABLE_COL.checkbox, TABLE_COL.name, TABLE_COL.statusBadge];
    const dynamic = dynamicCols.map(() => COL_SCORE);
    const clinic = TABLE_COL.statusBadge;
    return [...fixed, ...dynamic, clinic];
  }, [dynamicCols]);

  const focusHomeworkInput = (enrollmentId: number, homeworkId: number) => {
    homeworkInputRefs.current[`${enrollmentId}-${homeworkId}`]?.focus();
  };

  return (
    <DomainTable
      tableClassName="ds-table--flat ds-table--center"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
    >
      <colgroup>
        {colWidths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>

      <thead>
        <tr>
          <th scope="col" style={{ width: TABLE_COL.checkbox }} className="ds-checkbox-cell">
            {" "}
          </th>
          <th scope="col" style={{ width: TABLE_COL.name }}>
            이름
          </th>
          <th scope="col" style={{ width: TABLE_COL.statusBadge }}>
            출석
          </th>
          {dynamicCols.map((col) => (
            <th
              key={`${col.type}-${col.id}`}
              scope="col"
              style={{ width: COL_SCORE }}
              title={col.title}
              className="text-left"
            >
              {col.title}
            </th>
          ))}
          <th scope="col" style={{ width: TABLE_COL.statusBadge }}>
            클리닉
          </th>
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => {
          const selected = selectedEnrollmentId === row.enrollment_id;
          const clinicTarget = isClinicTarget(row);
          const showExpand = selected && selectedExamId != null && selectedHomeworkId == null && row.enrollment_id === selectedEnrollmentId;

          return (
            <Fragment key={row.enrollment_id}>
              <tr
                onClick={() => onSelectRow(row)}
                tabIndex={0}
                role="button"
                className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40 ${
                  selected ? "ds-row-selected" : ""
                }`}
              >
                <td
                  className="ds-checkbox-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="w-4 inline-block" />
                </td>

                <td
                  className="font-semibold min-w-0 text-[var(--color-text-primary)]"
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
                </td>

                <td
                  className="text-left"
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
                </td>

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
                    <td
                      key={`exam-${ex.exam_id}`}
                      className={`min-w-0 text-left align-top ${
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
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-medium">{scoreText}</span>
                          <PassFailBadge passed={block?.passed} />
                        </div>
                        <ProgressBadge
                          hasScore={!!hasScore}
                          isLocked={block?.is_locked}
                        />
                      </div>
                    </td>
                  );
                })}

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
                    <td
                      key={`hw-${hw.homework_id}`}
                      className={`min-w-0 text-left align-top ${
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
                      <div className="flex flex-col gap-1">
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
                    </td>
                  );
                })}

                <td
                  className="text-left"
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
                </td>
              </tr>

              {showExpand && (
                <tr key={`${row.enrollment_id}-expand`}>
                  <td
                    colSpan={colWidths.length}
                    className="!p-0 border-b border-[var(--color-border-divider)]"
                    style={{
                      background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
                      padding: "var(--space-4)",
                    }}
                  >
                    <div className="p-4">
                      <InlineExamItemsRow
                        examId={selectedExamId}
                        enrollmentId={row.enrollment_id}
                        variant="block"
                      />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </DomainTable>
  );
}
