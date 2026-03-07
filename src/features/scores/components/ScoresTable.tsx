// PATH: src/features/scores/components/ScoresTable.tsx
/**
 * 성적 탭 메인 테이블 — 동적 컬럼 구조
 * 디자인 SSOT: 학생(students) 도메인과 동일 — DomainTable + ds-table--flat
 *
 * 컬럼: 수정(전체선택) | 이름 | 출석 | [시험별: 주관식|객관식|합산|합불] | [과제별: 점수|합불] | 총괄 클리닉 대상 | 대상 사유
 * - 모든 점수·합불 가로 배치. 수정하기 행에서 체크된 컬럼만 기입 가능.
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

const COL_NARROW = 56;   // 합불 등 짧은 컬럼
const COL_SCORE = 72;   // 점수 입력 셀
const COL_REASON = 120; // 대상 사유

/** 합불 뱃지 (가로 배치용 인라인) */
function PassFailBadge({ passed }: { passed: boolean | null | undefined }) {
  if (passed == null) return null;
  const tone = passed ? "success" : "danger";
  return (
    <span className="ds-status-badge ds-status-badge--1ch" data-tone={tone}>
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
      { type: "clinic_target", key: "clinic_target", width: TABLE_COL.statusBadge + 20, editable: false },
      { type: "clinic_reason", key: "clinic_reason", width: COL_REASON, editable: false }
    );
    return list;
  }, [examOptions, homeworkOptions]);

  const editRowCols = useMemo(() => {
    const first = TABLE_COL.checkbox;
    return [first, ...columns.map((c) => c.width)];
  }, [columns]);

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
        {/* 수정하기 행: 헤더 바로 위 */}
        <tr className="bg-[var(--color-bg-surface-soft)] border-b border-[var(--border-divider)]">
          <th
            scope="col"
            style={{ width: TABLE_COL.checkbox }}
            className="ds-checkbox-cell text-center font-normal"
          >
            <label className="inline-flex items-center gap-1 cursor-pointer text-xs text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={editRowState.all || allEditableChecked}
                onChange={(e) => onEditRowChange("all", e.target.checked)}
                className="cursor-pointer"
                aria-label="전체 수정 허용"
              />
              수정
            </label>
          </th>
          {columns.map((col) => (
            <th key={col.key} scope="col" style={{ width: col.width }} className="ds-checkbox-cell text-center">
              {col.editable ? (
                <input
                  type="checkbox"
                  checked={editRowState.all || !!editRowState[col.key]}
                  onChange={(e) => {
                    e.stopPropagation();
                    onEditRowChange(col.key, e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                  aria-label={`${col.type === "exam" ? col.title : col.type === "homework" ? col.title : ""} 수정 허용`}
                />
              ) : null}
            </th>
          ))}
        </tr>
        {/* 헤더 행 */}
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
          {examOptions.map((ex) => (
            <Fragment key={ex.exam_id}>
              <th scope="col" style={{ width: COL_SCORE }} title={ex.title}>
                주관식
              </th>
              <th scope="col" style={{ width: COL_SCORE }} title={ex.title}>
                객관식
              </th>
              <th scope="col" style={{ width: COL_SCORE }} title={ex.title}>
                합산
              </th>
              <th scope="col" style={{ width: COL_NARROW }} title={ex.title}>
                합불
              </th>
            </Fragment>
          ))}
          {homeworkOptions.map((hw) => (
            <Fragment key={hw.homework_id}>
              <th scope="col" style={{ width: COL_SCORE }} title={hw.title}>
                점수
              </th>
              <th scope="col" style={{ width: COL_NARROW }} title={hw.title}>
                합불
              </th>
            </Fragment>
          ))}
          <th scope="col" style={{ width: TABLE_COL.statusBadge + 20 }}>
            총괄 클리닉 대상
          </th>
          <th scope="col" style={{ width: COL_REASON }}>
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
                <td className="ds-checkbox-cell" onClick={(e) => e.stopPropagation()}>
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

                <td className="text-left" onClick={() => onSelectRow(row)}>
                  {(() => {
                    const status = attendanceMap[row.enrollment_id];
                    if (!status)
                      return <span className="text-[var(--text-muted)]">-</span>;
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
                  const canEditTotal = isEditEnabled(`exam_${ex.exam_id}_total`);

                  return (
                    <Fragment key={ex.exam_id}>
                      <td
                        className="min-w-0 text-left align-middle"
                        style={{ padding: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                          -
                        </span>
                      </td>
                      <td
                        className="min-w-0 text-left align-middle"
                        style={{ padding: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                          -
                        </span>
                      </td>
                      <td
                        className={`min-w-0 text-left align-middle ${isSelected ? "ring-1 ring-[var(--color-primary)] rounded" : ""}`}
                        style={{ padding: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          {canEditTotal ? (
                            <span className="font-medium">{scoreText}</span>
                          ) : (
                            <span className="font-medium">{scoreText}</span>
                          )}
                        </span>
                      </td>
                      <td
                        className="min-w-0 text-left align-middle"
                        style={{ padding: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "exam", ex.exam_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <PassFailBadge passed={block?.passed} />
                        </span>
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
                  const hwStatus = getHomeworkStatus({
                    score: block?.score,
                    metaStatus: block?.meta?.status ?? null,
                  });
                  const canEditScore = isEditEnabled(`hw_${hw.homework_id}_score`);

                  return (
                    <Fragment key={hw.homework_id}>
                      <td
                        className={`min-w-0 text-left align-middle ${isSelected ? "ring-1 ring-[var(--color-primary)] rounded" : ""}`}
                        style={{ padding: 4 }}
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
                                <span className="font-medium">
                                  {block?.score != null
                                    ? String(block.score)
                                    : "-"}
                                </span>
                                <PassFailBadge passed={block?.passed} />
                              </>
                            )
                          ) : (
                            <span className="text-[var(--text-muted)]">-</span>
                          )}
                        </span>
                      </td>
                      <td
                        className="min-w-0 text-left align-middle"
                        style={{ padding: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(row, "homework", hw.homework_id);
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <PassFailBadge passed={block?.passed} />
                        </span>
                      </td>
                    </Fragment>
                  );
                })}

                <td
                  className="text-left align-middle"
                  onClick={() => onSelectRow(row)}
                >
                  <span className="inline-flex items-center gap-1">
                    {clinicTarget ? (
                      <span
                        className="ds-status-badge"
                        data-tone="danger"
                        title="클리닉 대상"
                      >
                        대상
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">해당없음</span>
                    )}
                  </span>
                </td>

                <td
                  className="text-left align-middle text-[var(--color-text-secondary)]"
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
