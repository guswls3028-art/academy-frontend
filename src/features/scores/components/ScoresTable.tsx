// PATH: src/features/scores/components/ScoresTable.tsx
/**
 * 성적 탭 메인 테이블 — 동적 컬럼 구조 (SSOT·UX 설계 문서 준수)
 * - 기본 Read-only, Edit Mode 시에만 입력
 * - 3행 헤더: Row1 그룹 | Row2 시험명/과제명 | Row3 점수/합불
 * - 시험/과제 컬럼: exam.title, homework.title 기반 1:1, 서브컬럼 score / pass_fail
 * - 디자인 토큰만 사용, DomainTable 기반
 */

import { useMemo, useRef, useEffect, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import InlineExamItemsRow from "./InlineExamItemsRow";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import HomeworkQuickInput from "./HomeworkQuickInput";
import { getHomeworkStatus } from "../utils/homeworkStatus";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { DomainTable, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import AttendanceStatusBadge, {
  type AttendanceStatus,
} from "@/shared/ui/badges/AttendanceStatusBadge";

/** 컬럼 기본 너비 — 설계 문서 12️⃣ */
const COL_EDIT = 80;
const COL_NAME = 160;
const COL_ATTENDANCE = 80;
const COL_SCORE = 84;
const COL_PASS = 64;
const COL_CLINIC_TARGET = 80;
const COL_REASON = 180;

/** 시험 블록 배경 — flat 테이블과 동일 토큰(--color-primary), 5% */
const BG_EXAM = "color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-surface))";
/** 과제 블록 배경 — flat 테이블과 동일 토큰, 4% */
const BG_HOMEWORK = "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))";

/** 합불 뱃지 — 시험/과제 컬럼용 완성형 */
function PassFailBadge({ passed }: { passed: boolean | null | undefined }) {
  if (passed == null) return <span className="text-[var(--color-text-muted)]">-</span>;
  const tone = passed ? "success" : "danger";
  return (
    <span
      className="ds-status-badge inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-md text-xs font-semibold"
      data-tone={tone}
    >
      {passed ? "합" : "불"}
    </span>
  );
}

/** 클리닉 대상 여부 + 대상 사유 (시험 / 시험+과제 / 과제) */
function getClinicReason(row: SessionScoreRow): { target: boolean; reason: string } {
  const examFail = row.exams?.some((e) => e.block.passed === false) ?? false;
  const hwFail =
    row.homeworks?.some((h) => {
      const st = getHomeworkStatus({
        score: h.block.score,
        metaStatus: h.block.meta?.status ?? null,
      });
      return st === "NOT_SUBMITTED" || h.block.passed === false;
    }) ?? false;
  if (!examFail && !hwFail) return { target: false, reason: "" };
  if (examFail && hwFail) return { target: true, reason: "시험+과제" };
  if (examFail) return { target: true, reason: "시험" };
  return { target: true, reason: "과제" };
}

export type ScoreColumnDef =
  | { type: "name"; key: "name"; width: number; editable: false }
  | { type: "attendance"; key: "attendance"; width: number; editable: false }
  | {
      type: "exam";
      examId: number;
      title: string;
      sub: "score" | "pass";
      key: string;
      width: number;
      editable: boolean;
    }
  | {
      type: "homework";
      homeworkId: number;
      title: string;
      sub: "score" | "pass";
      key: string;
      width: number;
      editable: boolean;
    }
  | { type: "clinic_target"; key: "clinic_target"; width: number; editable: false }
  | { type: "clinic_reason"; key: "clinic_reason"; width: number; editable: false };

type Props = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta | null;
  sessionId: number;
  attendanceMap?: Record<number, string>;

  /** 편집 모드일 때만 점수 셀 입력 가능. 기본은 읽기 전용 */
  isEditMode?: boolean;

  selectedEnrollmentId: number | null;
  selectedExamId: number | null;
  selectedHomeworkId: number | null;
  onSelectCell: (row: SessionScoreRow, type: "exam" | "homework", id: number) => void;
  onSelectRow: (row: SessionScoreRow) => void;

  focusHomeworkCell?: { enrollmentId: number; homeworkId: number } | null;
  onFocusHomeworkDone?: () => void;

  /** 키보드 셀 이동 — Tab/Enter/Arrow 시 패널에서 다음 셀로 이동 후 focusHomeworkCell 설정 */
  onRequestMoveNext?: () => void;
  onRequestMovePrev?: () => void;
  onRequestMoveDown?: () => void;
  onRequestMoveUp?: () => void;

  selectedEnrollmentIds?: number[];
  onSelectionChange?: (enrollmentIds: number[]) => void;
};

export default function ScoresTable({
  rows,
  meta,
  sessionId,
  attendanceMap = {},
  isEditMode = false,
  selectedEnrollmentId,
  selectedExamId,
  selectedHomeworkId,
  onSelectCell,
  onSelectRow,
  focusHomeworkCell,
  onFocusHomeworkDone,
  onRequestMoveNext,
  onRequestMovePrev,
  onRequestMoveDown,
  onRequestMoveUp,
  selectedEnrollmentIds = [],
  onSelectionChange,
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

  const columns = useMemo((): ScoreColumnDef[] => {
    const list: ScoreColumnDef[] = [
      { type: "name", key: "name", width: COL_NAME, editable: false },
      { type: "attendance", key: "attendance", width: COL_ATTENDANCE, editable: false },
    ];
    examOptions.forEach((e) => {
      list.push(
        { type: "exam", examId: e.exam_id, title: e.title, sub: "score", key: `exam_${e.exam_id}_score`, width: COL_SCORE, editable: true },
        { type: "exam", examId: e.exam_id, title: e.title, sub: "pass", key: `exam_${e.exam_id}_pass`, width: COL_PASS, editable: false }
      );
    });
    homeworkOptions.forEach((h) => {
      list.push(
        { type: "homework", homeworkId: h.homework_id, title: h.title, sub: "score", key: `hw_${h.homework_id}_score`, width: COL_SCORE, editable: true },
        { type: "homework", homeworkId: h.homework_id, title: h.title, sub: "pass", key: `hw_${h.homework_id}_pass`, width: COL_PASS, editable: false }
      );
    });
    list.push(
      { type: "clinic_target", key: "clinic_target", width: COL_CLINIC_TARGET, editable: false },
      { type: "clinic_reason", key: "clinic_reason", width: COL_REASON, editable: false }
    );
    return list;
  }, [examOptions, homeworkOptions]);

  const columnDefs = useMemo((): TableColumnDef[] => {
    return [
      { key: "select", label: "선택", defaultWidth: COL_EDIT, minWidth: 40, maxWidth: 120 },
      ...columns.map((c) => ({
        key: c.key,
        label: c.key,
        defaultWidth: c.width,
        minWidth: c.key === "name" ? 100 : c.key === "clinic_reason" ? 140 : 48,
        maxWidth: 500,
      })),
    ];
  }, [columns]);

  const { columnWidths, setColumnWidth } = useTableColumnPrefs("session-scores", columnDefs);

  const tableCols = useMemo(() => {
    return [
      columnWidths.select ?? COL_EDIT,
      ...columns.map((c) => columnWidths[c.key] ?? c.width),
    ];
  }, [columns, columnWidths]);

  const tableWidth = useMemo(
    () => tableCols.reduce((s, w) => s + w, 0),
    [tableCols]
  );

  const selectedSet = useMemo(() => new Set(selectedEnrollmentIds), [selectedEnrollmentIds]);
  const allSelected =
    rows.length > 0 &&
    rows.every((r) => selectedSet.has(r.enrollment_id));

  const focusHomeworkInput = (enrollmentId: number, homeworkId: number) => {
    homeworkInputRefs.current[`${enrollmentId}-${homeworkId}`]?.focus();
  };

  return (
    <DomainTable
      tableClassName="ds-table--flat ds-table--center ds-scores-table"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
    >
      <colgroup>
        {tableCols.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>

      <thead>
        {/* Row1: 선택 | 이름 | 출석 | [시험 뱃지] 시험이름 (colSpan=2) 반복 | [과제 뱃지] 과제이름 (colSpan=2) 반복 | 클리닉 | 사유 — flat 스타일(students와 동일) */}
        <tr className="border-b border-[var(--color-border-divider)]">
          <ResizableTh
            columnKey="select"
            width={columnWidths.select ?? COL_EDIT}
            minWidth={40}
            maxWidth={120}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            noWrap
            className="ds-checkbox-cell align-top py-2.5 px-2 border-r-2 border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)]"
          >
            {onSelectionChange ? (
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectionChange(rows.map((r) => r.enrollment_id));
                    } else {
                      onSelectionChange([]);
                    }
                  }}
                  className="cursor-pointer w-4 h-4"
                  aria-label="전체 선택"
                />
              </label>
            ) : (
              <span className="w-4 inline-block" />
            )}
          </ResizableTh>
          <ResizableTh
            columnKey="name"
            width={columnWidths.name ?? COL_NAME}
            minWidth={100}
            maxWidth={400}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3 border-l-2 border-[var(--color-border-divider)]"
          >
            이름
          </ResizableTh>
          <ResizableTh
            columnKey="attendance"
            width={columnWidths.attendance ?? COL_ATTENDANCE}
            minWidth={60}
            maxWidth={120}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3"
          >
            출석
          </ResizableTh>
          {examOptions.map((ex) => (
            <th
              key={`head-exam-${ex.exam_id}`}
              scope="col"
              colSpan={2}
              className="text-left font-medium text-[var(--color-text-primary)] py-2 px-3 truncate"
              style={{ backgroundColor: BG_EXAM }}
              title={ex.title}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="ds-status-badge ds-status-badge--1ch" data-tone="primary" aria-label="시험">
                  시
                </span>
                <span className="truncate">{ex.title}</span>
              </span>
            </th>
          ))}
          {homeworkOptions.map((hw) => (
            <th
              key={`head-hw-${hw.homework_id}`}
              scope="col"
              colSpan={2}
              className="text-left font-medium text-[var(--color-text-primary)] py-2 px-3 truncate"
              style={{ backgroundColor: BG_HOMEWORK }}
              title={hw.title}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="ds-status-badge ds-status-badge--1ch" data-tone="neutral" aria-label="과제">
                  과
                </span>
                <span className="truncate">{hw.title}</span>
              </span>
            </th>
          ))}
          <ResizableTh
            columnKey="clinic_target"
            width={columnWidths.clinic_target ?? COL_CLINIC_TARGET}
            minWidth={60}
            maxWidth={140}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3"
          >
            판정
          </ResizableTh>
          <ResizableTh
            columnKey="clinic_reason"
            width={columnWidths.clinic_reason ?? COL_REASON}
            minWidth={140}
            maxWidth={400}
            onWidthChange={setColumnWidth}
            rowSpan={2}
            className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3 min-w-0"
          >
            사유
          </ResizableTh>
        </tr>
        {/* Row2: 점수 | 합불 (시험별) | 점수 | 합불 (과제별) */}
        <tr className="border-b-2 border-[var(--color-border-divider)]">
          {examOptions.map((ex) => (
            <Fragment key={ex.exam_id}>
              <ResizableTh
                columnKey={`exam_${ex.exam_id}_score`}
                width={columnWidths[`exam_${ex.exam_id}_score`] ?? COL_SCORE}
                minWidth={48}
                maxWidth={200}
                onWidthChange={setColumnWidth}
                className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                style={{ backgroundColor: BG_EXAM }}
              >
                점수
              </ResizableTh>
              <ResizableTh
                columnKey={`exam_${ex.exam_id}_pass`}
                width={columnWidths[`exam_${ex.exam_id}_pass`] ?? COL_PASS}
                minWidth={48}
                maxWidth={100}
                onWidthChange={setColumnWidth}
                className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                style={{ backgroundColor: BG_EXAM }}
              >
                합불
              </ResizableTh>
            </Fragment>
          ))}
          {homeworkOptions.map((hw) => (
            <Fragment key={hw.homework_id}>
              <ResizableTh
                columnKey={`hw_${hw.homework_id}_score`}
                width={columnWidths[`hw_${hw.homework_id}_score`] ?? COL_SCORE}
                minWidth={48}
                maxWidth={200}
                onWidthChange={setColumnWidth}
                className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                style={{ backgroundColor: BG_HOMEWORK }}
              >
                점수
              </ResizableTh>
              <ResizableTh
                columnKey={`hw_${hw.homework_id}_pass`}
                width={columnWidths[`hw_${hw.homework_id}_pass`] ?? COL_PASS}
                minWidth={48}
                maxWidth={100}
                onWidthChange={setColumnWidth}
                className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3"
                style={{ backgroundColor: BG_HOMEWORK }}
              >
                합불
              </ResizableTh>
            </Fragment>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((row, rowIndex) => {
          const selected = selectedEnrollmentId === row.enrollment_id;
          const rowChecked = selectedSet.has(row.enrollment_id);
          const { target: clinicTarget, reason: clinicReason } = getClinicReason(row);
          const showExpand =
            selected &&
            selectedExamId != null &&
            selectedHomeworkId == null &&
            row.enrollment_id === selectedEnrollmentId;
          const isEvenRow = rowIndex % 2 === 1;

          return (
            <Fragment key={row.enrollment_id}>
              <tr
                onClick={() => onSelectRow(row)}
                tabIndex={0}
                role="button"
                className={`cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-brand-primary)] ${selected ? "ds-row-selected" : ""} ${rowChecked ? "ds-scores-table-row--checked" : ""} hover:bg-[var(--color-bg-surface-hover)] ${isEvenRow ? "ds-scores-table-row--alt" : ""}`}
              >
                <td
                  className="ds-checkbox-cell align-middle py-2.5 px-3 border-r-2 border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onSelectionChange ? (
                    <input
                      type="checkbox"
                      checked={selectedSet.has(row.enrollment_id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.checked) {
                          onSelectionChange([...selectedEnrollmentIds, row.enrollment_id]);
                        } else {
                          onSelectionChange(selectedEnrollmentIds.filter((id) => id !== row.enrollment_id));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${row.student_name} 선택`}
                      className="cursor-pointer"
                    />
                  ) : (
                    <span className="w-4 inline-block" />
                  )}
                </td>

                <td
                  className={`font-semibold min-w-0 text-[var(--color-text-primary)] py-2.5 px-3 align-middle border-l-2 border-[var(--color-border-divider)] ${row.name_highlight_clinic_no_reservation ? "ds-table-cell-name--clinic-no-reservation" : ""}`}
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

                <td className="text-left py-2.5 px-3 align-middle" onClick={() => onSelectRow(row)}>
                  {(() => {
                    const status = attendanceMap[row.enrollment_id];
                    if (!status)
                      return <span className="text-[var(--color-text-muted)]">-</span>;
                    return (
                      <AttendanceStatusBadge
                        status={status as AttendanceStatus}
                        variant="2ch"
                      />
                    );
                  })()}
                </td>

                {/* 시험: 점수 | 합불 — 4️⃣ exam_{id}_score, exam_{id}_pass */}
                {examOptions.map((ex) => {
                  const entry =
                    row.exams?.find((e) => e.exam_id === ex.exam_id) ?? null;
                  const block = entry?.block;
                  const isSelected =
                    selected &&
                    selectedExamId === ex.exam_id &&
                    selectedHomeworkId == null;
                  const scoreText =
                    block?.score == null
                      ? "-"
                      : block?.max_score != null && block.max_score > 0
                        ? `${Math.round(block.score)}/${Math.round(block.max_score)}`
                        : `${Math.round(block!.score)}점`;

                  return (
                    <Fragment key={ex.exam_id}>
                      <td
                        className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                        style={rowChecked ? undefined : { backgroundColor: isSelected ? "var(--color-bg-surface)" : BG_EXAM }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        <span className="font-medium text-[var(--color-text-primary)]">{scoreText}</span>
                      </td>
                      <td
                        className="min-w-0 text-left align-middle py-2.5 px-3"
                        style={rowChecked ? undefined : { backgroundColor: BG_EXAM }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        <PassFailBadge passed={block?.passed} />
                      </td>
                    </Fragment>
                  );
                })}

                {/* 과제: 점수(점수만) | 합불 — 점수 칸에는 합불 미표시(합불 컬럼에만) */}
                {homeworkOptions.map((hw) => {
                  const entry =
                    row.homeworks?.find(
                      (h) => h.homework_id === hw.homework_id
                    ) ?? null;
                  const block = entry?.block;
                  const isSelected = selected && selectedHomeworkId === hw.homework_id;
                  const canEditScore = isEditMode;

                  return (
                    <Fragment key={hw.homework_id}>
                      <td
                        className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "outline-2 outline-[var(--color-brand-primary)] outline-offset-[-2px]" : ""} ${isEditMode ? "hover:bg-[var(--color-bg-surface-hover)]" : ""}`}
                        style={rowChecked ? undefined : { backgroundColor: isSelected ? "var(--color-bg-surface)" : BG_HOMEWORK }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "homework", hw.homework_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {entry ? (
                            canEditScore ? (
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
                                onMoveUp={onRequestMoveUp}
                                onMoveDown={onRequestMoveDown}
                                onMoveNext={onRequestMoveNext}
                                onMovePrev={onRequestMovePrev}
                              />
                            ) : (
                              <span className="font-medium text-[var(--color-text-primary)]">
                                {block?.score != null
                                  ? String(block.score)
                                  : "-"}
                              </span>
                            )
                          ) : (
                            <span className="text-[var(--color-text-muted)]">-</span>
                          )}
                        </span>
                      </td>
                      <td
                        className="min-w-0 text-left align-middle py-2.5 px-3"
                        style={rowChecked ? undefined : { backgroundColor: BG_HOMEWORK }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "homework", hw.homework_id);
                        }}
                      >
                        <PassFailBadge passed={block?.passed} />
                      </td>
                    </Fragment>
                  );
                })}

                <td
                  className="text-left align-middle py-2.5 px-3"
                  onClick={() => onSelectRow(row)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {clinicTarget ? (
                      <span
                        className="ds-status-badge px-2 py-0.5 rounded-md text-xs font-medium"
                        data-tone="danger"
                        title="클리닉 대상"
                      >
                        대상
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">해당없음</span>
                    )}
                  </span>
                </td>

                <td
                  className="text-left align-middle py-2.5 px-3 text-[var(--color-text-secondary)] text-sm min-w-0"
                  onClick={() => onSelectRow(row)}
                >
                  {clinicReason || "-"}
                </td>
              </tr>

              {showExpand && (
                <tr key={`${row.enrollment_id}-expand`}>
                  <td
                    colSpan={tableCols.length}
                    className="!p-0 border-b border-[var(--color-border-divider)]"
                    style={{
                      background:
                        "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
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
