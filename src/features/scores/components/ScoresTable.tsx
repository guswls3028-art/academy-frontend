// PATH: src/features/scores/components/ScoresTable.tsx
/**
 * 성적 탭 메인 테이블 — 동적 컬럼 구조
 * 디자인 SSOT: 학생(students) 도메인과 동일 — DomainTable + ds-table--flat
 * 컬럼 너비: TABLE_COL SSOT (checkbox 28, name 140, statusBadge 68) — tableColumnSpec
 *
 * 컬럼: 수정(전체선택) | 이름 | 출석 | [시험별: 주관식|객관식|합산|합불] | [과제별: 점수|합불] | 총괄 클리닉 대상 | 대상 사유
 * - 모든 점수·합불 가로 배치. 수정하기 행에서 체크된 컬럼만 기입 가능.
 */

import { useMemo, useRef, useEffect, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FiEdit2 } from "react-icons/fi";

import type { SessionScoreRow, SessionScoreMeta } from "../api/sessionScores";
import InlineExamItemsRow from "./InlineExamItemsRow";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import HomeworkQuickInput from "./HomeworkQuickInput";
import { getHomeworkStatus } from "../utils/homeworkStatus";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { DomainTable, TABLE_COL, ResizableTh, useTableColumnPrefs } from "@/shared/ui/domain";
import type { TableColumnDef } from "@/shared/ui/domain";
import AttendanceStatusBadge, {
  type AttendanceStatus,
} from "@/shared/ui/badges/AttendanceStatusBadge";

const COL_NARROW = 64;   // 합불 뱃지 — 가독성
const COL_SCORE = 84;   // 점수 입력 셀 — 여유
const COL_REASON = 180; // 대상 사유 — "총괄 클리닉 대상 사유" 가시성
const COL_CLINIC_TARGET = 100; // 총괄 클리닉 대상
const COL_EDIT_SELECT = 80; // 수정/선택 통합 컬럼 (아이콘+라벨 여유)

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
      sub: "subj" | "obj" | "total" | "pass";
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

export type EditRowState = {
  all: boolean;
  [key: string]: boolean;
};

type Props = {
  rows: SessionScoreRow[];
  meta: SessionScoreMeta | null;
  sessionId: number;
  attendanceMap?: Record<number, string>;

  selectedEnrollmentId: number | null;
  selectedExamId: number | null;
  selectedHomeworkId: number | null;
  onSelectCell: (row: SessionScoreRow, type: "exam" | "homework", id: number) => void;
  onSelectRow: (row: SessionScoreRow) => void;

  /** 수정하기 행: 전체선택 + 컬럼별 편집 허용. 기본 전부 false */
  editRowState: EditRowState;
  onEditRowChange: (key: string | "all", value: boolean) => void;

  focusHomeworkCell?: { enrollmentId: number; homeworkId: number } | null;
  onFocusHomeworkDone?: () => void;

  /** 일괄 작업용 행 선택 (캡처: 18명을 대상으로 성적 일괄 변경 등) */
  selectedEnrollmentIds?: number[];
  onSelectionChange?: (enrollmentIds: number[]) => void;
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
  editRowState,
  onEditRowChange,
  focusHomeworkCell,
  onFocusHomeworkDone,
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
      { type: "name", key: "name", width: TABLE_COL.name, editable: false },
      { type: "attendance", key: "attendance", width: TABLE_COL.statusBadge, editable: false },
    ];
    examOptions.forEach((e) => {
      list.push(
        { type: "exam", examId: e.exam_id, title: e.title, sub: "subj", key: `exam_${e.exam_id}_subj`, width: COL_SCORE, editable: true },
        { type: "exam", examId: e.exam_id, title: e.title, sub: "obj", key: `exam_${e.exam_id}_obj`, width: COL_SCORE, editable: true },
        { type: "exam", examId: e.exam_id, title: e.title, sub: "total", key: `exam_${e.exam_id}_total`, width: COL_SCORE, editable: true },
        { type: "exam", examId: e.exam_id, title: e.title, sub: "pass", key: `exam_${e.exam_id}_pass`, width: COL_NARROW, editable: false }
      );
    });
    homeworkOptions.forEach((h) => {
      list.push(
        { type: "homework", homeworkId: h.homework_id, title: h.title, sub: "score", key: `hw_${h.homework_id}_score`, width: COL_SCORE, editable: true },
        { type: "homework", homeworkId: h.homework_id, title: h.title, sub: "pass", key: `hw_${h.homework_id}_pass`, width: COL_NARROW, editable: false }
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
      { key: "edit", label: "수정", defaultWidth: COL_EDIT_SELECT, minWidth: 56, maxWidth: 140 },
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

  const editRowCols = useMemo(() => {
    return [
      columnWidths.edit ?? COL_EDIT_SELECT,
      ...columns.map((c) => columnWidths[c.key] ?? c.width),
    ];
  }, [columns, columnWidths]);

  const tableWidth = useMemo(
    () => editRowCols.reduce((s, w) => s + w, 0),
    [editRowCols]
  );

  const isEditEnabled = (key: string): boolean => {
    if (editRowState.all) return true;
    return !!editRowState[key];
  };

  const editableKeys = useMemo(
    () => columns.filter((c) => c.editable).map((c) => c.key),
    [columns]
  );

  const allEditableChecked = useMemo(
    () => editableKeys.every((k) => editRowState[k]),
    [editableKeys, editRowState]
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
      tableClassName="ds-table--flat ds-table--center"
      tableStyle={{ tableLayout: "fixed", width: tableWidth }}
    >
      <colgroup>
        {editRowCols.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>

      <thead>
        {/* 1행: 수정(전체/컬럼별 편집 허용) — 첫 셀만 rowSpan=3으로 수정/선택 통합, 경계 명확 */}
        <tr className="bg-[var(--color-bg-surface-soft)] border-b-2 border-[var(--color-border-divider)]">
          <ResizableTh
            columnKey="edit"
            width={columnWidths.edit ?? COL_EDIT_SELECT}
            minWidth={56}
            maxWidth={140}
            onWidthChange={setColumnWidth}
            rowSpan={3}
            noWrap
            className="ds-scores-edit-column align-top py-2.5 px-2 border-r-2 border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)] shadow-[2px_0_6px_rgba(0,0,0,0.06)]"
          >
            <div className="flex flex-col gap-2.5 items-center w-full">
              <label
                className={`ds-scores-edit-trigger flex flex-col items-center gap-1.5 cursor-pointer rounded-xl border-2 px-2.5 py-2 w-full transition-all duration-200 group ${
                  editRowState.all || allEditableChecked
                    ? "border-[var(--color-brand-primary)] bg-[color-mix(in_srgb,var(--color-brand-primary)_10%,transparent)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    : "border-dashed border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-bg-surface)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                }`}
                title="체크 시 아래 점수·합불 컬럼을 수정할 수 있습니다"
              >
                <FiEdit2
                  className={`w-5 h-5 ${editRowState.all || allEditableChecked ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-primary)]"}`}
                  aria-hidden
                />
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    editRowState.all || allEditableChecked ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-brand-primary)]"
                  }`}
                >
                  수정
                </span>
                <span className="text-[9px] text-[var(--color-text-muted)]">편집 허용</span>
                <input
                  type="checkbox"
                  checked={editRowState.all || allEditableChecked}
                  onChange={(e) => onEditRowChange("all", e.target.checked)}
                  className="cursor-pointer w-4 h-4 mt-0.5"
                  aria-label="전체 수정 허용"
                />
              </label>
              {onSelectionChange && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-[var(--color-text-muted)]">
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
                  선택
                </label>
              )}
            </div>
          </ResizableTh>
          {columns.map((col, idx) => (
            <ResizableTh
              key={col.key}
              columnKey={col.key}
              width={columnWidths[col.key] ?? col.width}
              minWidth={40}
              maxWidth={400}
              onWidthChange={setColumnWidth}
              className={`ds-checkbox-cell text-center py-1 ${idx === 0 ? "border-l-2 border-[var(--color-border-divider)]" : ""}`}
            >
              {col.editable ? (
                <input
                  type="checkbox"
                  checked={editRowState.all || !!editRowState[col.key]}
                  onChange={(e) => {
                    e.stopPropagation();
                    onEditRowChange(col.key, e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer w-3.5 h-3.5"
                  aria-label={`${col.type === "exam" ? col.title : col.type === "homework" ? col.title : ""} 수정 허용`}
                />
              ) : null}
            </ResizableTh>
          ))}
        </tr>
        {/* 2행: 시험/과제명 — 수정 컬럼과 경계 구분 */}
        <tr className="border-b border-[var(--color-border-divider)] bg-[var(--color-bg-surface)]">
          <th scope="col" className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3 border-l-2 border-[var(--color-border-divider)]">
            이름
          </th>
          <th scope="col" className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3">
            출석
          </th>
          {examOptions.map((ex) => (
            <th
              key={`name-exam-${ex.exam_id}`}
              scope="col"
              colSpan={4}
              className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3 truncate"
              title={ex.title}
            >
              {ex.title}
            </th>
          ))}
          {homeworkOptions.map((hw) => (
            <th
              key={`name-hw-${hw.homework_id}`}
              scope="col"
              colSpan={2}
              className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3 truncate"
              title={hw.title}
            >
              {hw.title}
            </th>
          ))}
          <th scope="col" className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3">
            총괄 클리닉 대상
          </th>
          <th scope="col" className="text-left font-semibold text-[var(--color-text-primary)] py-2.5 px-3 min-w-0">
            대상 사유
          </th>
        </tr>
        {/* 3행: 서브 헤더 — 주관식/객관식/합산/합불, 점수/합불 */}
        <tr className="border-b-2 border-[var(--color-border-divider)]">
          <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3 border-l-2 border-[var(--color-border-divider)]">
            이름
          </th>
          <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3">
            출석
          </th>
          {examOptions.map((ex) => (
            <Fragment key={ex.exam_id}>
              <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3" title={`${ex.title} 주관식`}>
                주관식
              </th>
              <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3" title={`${ex.title} 객관식`}>
                객관식
              </th>
              <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3" title={`${ex.title} 합산`}>
                합산
              </th>
              <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3" title={`${ex.title} 합불`}>
                합불
              </th>
            </Fragment>
          ))}
          {homeworkOptions.map((hw) => (
            <Fragment key={hw.homework_id}>
              <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3" title={`${hw.title} 점수`}>
                점수
              </th>
              <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3" title={`${hw.title} 합불`}>
                합불
              </th>
            </Fragment>
          ))}
          <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3">
            총괄 클리닉 대상
          </th>
          <th scope="col" className="text-left text-xs font-medium text-[var(--color-text-secondary)] py-2 px-3">
            대상 사유
          </th>
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => {
          const selected = selectedEnrollmentId === row.enrollment_id;
          const { target: clinicTarget, reason: clinicReason } = getClinicReason(row);
          const showExpand =
            selected &&
            selectedExamId != null &&
            selectedHomeworkId == null &&
            row.enrollment_id === selectedEnrollmentId;

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
                  className="ds-checkbox-cell align-middle py-2.5 px-3 border-r-2 border-[var(--color-border-divider)] bg-[var(--color-bg-surface-hover)] shadow-[2px_0_6px_rgba(0,0,0,0.06)]"
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
                  className="font-semibold min-w-0 text-[var(--color-text-primary)] py-2.5 px-3 align-middle border-l-2 border-[var(--color-border-divider)]"
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

                {/* 시험: 주관식 | 객관식 | 합산 | 합불 — 가로 배치. API에 주관/객관 없으면 합산만 표시 */}
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
                        className="min-w-0 text-left align-middle py-2.5 px-3 text-[var(--color-text-muted)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        -
                      </td>
                      <td
                        className="min-w-0 text-left align-middle py-2.5 px-3 text-[var(--color-text-muted)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        -
                      </td>
                      <td
                        className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "ring-2 ring-[var(--color-brand-primary)] ring-inset rounded-md bg-[var(--color-bg-surface)]" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        <span className="font-medium text-[var(--color-text-primary)]">{scoreText}</span>
                      </td>
                      <td
                        className="min-w-0 text-left align-middle py-2.5 px-3"
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

                {/* 과제: 점수 | 합불 — 가로 배치 */}
                {homeworkOptions.map((hw) => {
                  const entry =
                    row.homeworks?.find(
                      (h) => h.homework_id === hw.homework_id
                    ) ?? null;
                  const block = entry?.block;
                  const isSelected = selected && selectedHomeworkId === hw.homework_id;
                  const canEditScore = isEditEnabled(`hw_${hw.homework_id}_score`);

                  return (
                    <Fragment key={hw.homework_id}>
                      <td
                        className={`min-w-0 text-left align-middle py-2.5 px-3 ${isSelected ? "ring-2 ring-[var(--color-brand-primary)] ring-inset rounded-md bg-[var(--color-bg-surface)]" : ""} ${canEditScore ? "bg-[color-mix(in_srgb,var(--color-bg-surface-hover)_50%,transparent)]" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "homework", hw.homework_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {entry ? (
                            canEditScore ? (
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
                              <>
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  {block?.score != null
                                    ? String(block.score)
                                    : "-"}
                                </span>
                                <PassFailBadge passed={block?.passed} />
                              </>
                            )
                          ) : (
                            <span className="text-[var(--color-text-muted)]">-</span>
                          )}
                        </span>
                      </td>
                      <td
                        className="min-w-0 text-left align-middle py-2.5 px-3"
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
                    colSpan={editRowCols.length}
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
