// PATH: src/features/clinic/components/ClinicTargetSelectModal.tsx
// 클리닉 생성 — 대상자 선택 모달 (수강대상등록 스타일, 예약 대상자 | 전체 학생 탭)

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "antd";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { TABLE_COL } from "@/shared/ui/domain";

import { useClinicTargets } from "../hooks/useClinicTargets";
import { useClinicStudentSearch } from "../hooks/useClinicStudentSearch";
import { fetchClinicStudentsDefault } from "../api/clinicStudents.api";

type TargetRow = { enrollment_id: number; student_name: string };
type StudentRow = { id: number; name: string };

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

import {
  type EnrollmentSelection,
  type StudentSelection,
  enrollmentSelection,
  studentSelection,
} from "@/shared/types/selection";

export type ClinicTargetSelectResult = EnrollmentSelection | StudentSelection;

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: "targets" | "students";
  initialSelectedIds?: number[];
  onConfirm: (result: ClinicTargetSelectResult) => void;
};

const EMPTY_IDS: number[] = [];

export default function ClinicTargetSelectModal({
  open,
  onClose,
  initialMode = "targets",
  initialSelectedIds,
  onConfirm,
}: Props) {
  const stableIds = initialSelectedIds ?? EMPTY_IDS;
  const [mode, setMode] = useState<"targets" | "students">(initialMode);
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>(() => [...stableIds]);
  /** 선택된 id → 이름 (우측 목록 표시용, 검색/탭 변경 후에도 유지) */
  const [selectedIdToName, setSelectedIdToName] = useState<Map<number, string>>(new Map());

  const prevOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!open || wasOpen) return;
    // 모달이 닫힌→열린 전환 시에만 초기화
    setMode(initialMode);
    setKeyword("");
    setSelectedIds([...stableIds]);
    setSelectedIdToName(new Map());
  }, [open, initialMode, stableIds]);

  const targetsQ = useClinicTargets();
  const studentsSearchQ = useClinicStudentSearch(keyword);
  const studentsDefaultQ = useQuery({
    queryKey: ["clinic-students-default"],
    queryFn: fetchClinicStudentsDefault,
    enabled: open && mode === "students" && keyword.trim().length < 2,
    staleTime: 10_000,
    retry: 0,
  });

  const rows = useMemo(() => {
    if (mode === "targets") {
      const arr = (targetsQ.data ?? []) as TargetRow[];
      if (!keyword.trim()) return arr;
      return arr.filter((t) => (t.student_name || "").includes(keyword.trim()));
    }
    if (keyword.trim().length >= 2) return (studentsSearchQ.data ?? []) as StudentRow[];
    return (studentsDefaultQ.data ?? []) as StudentRow[];
  }, [mode, targetsQ.data, keyword, studentsSearchQ.data, studentsDefaultQ.data]);

  const isLoading =
    (mode === "targets" && targetsQ.isLoading) ||
    (mode === "students" && (keyword.trim().length < 2 ? studentsDefaultQ.isLoading : studentsSearchQ.isLoading));

  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(mode === "targets" ? (r as TargetRow).enrollment_id : (r as StudentRow).id));

  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds([]);
      setSelectedIdToName(new Map());
      return;
    }
    if (mode === "targets") {
      const rowsT = rows as TargetRow[];
      setSelectedIds(rowsT.map((r) => r.enrollment_id));
      setSelectedIdToName(new Map(rowsT.map((r) => [r.enrollment_id, r.student_name ?? ""])));
    } else {
      const rowsS = rows as StudentRow[];
      setSelectedIds(rowsS.map((r) => r.id));
      setSelectedIdToName(new Map(rowsS.map((r) => [r.id, r.name ?? ""])));
    }
  };

  const toggleOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
    setSelectedIdToName((prev) => {
      const next = new Map(prev);
      if (checked) {
        const name = mode === "targets"
          ? (rows as TargetRow[]).find((r) => r.enrollment_id === id)?.student_name
          : (rows as StudentRow[]).find((r) => r.id === id)?.name;
        if (name != null) next.set(id, name);
      } else next.delete(id);
      return next;
    });
  };

  const removeSelected = (id: number) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setSelectedIdToName((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const selectedRowsForDisplay = useMemo(() => {
    return selectedIds.map((id) => ({ id, name: selectedIdToName.get(id) ?? "(이름 없음)" }));
  }, [selectedIds, selectedIdToName]);

  const handleConfirm = () => {
    if (mode === "targets") {
      onConfirm(enrollmentSelection(selectedIds));
    } else {
      onConfirm(studentSelection(selectedIds));
    }
    onClose();
  };

  if (!open) return null;

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={840}>
      <ModalHeader
        type="action"
        title="대상자 선택"
        description="예약 대상자 또는 전체 학생 중 클리닉 대상자를 선택하세요."
      />

      <ModalBody>
        <div
          className="grid gap-4 min-h-0 overflow-hidden ds-split-layout"
          style={{
            gridTemplateColumns: "1fr 220px",
            maxHeight: "min(78vh, 600px)",
            minHeight: 420,
          }}
        >
          {/* 좌측: 탭(예약 대상자 | 전체 학생) + 검색 + 툴바 + 테이블 */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="flex gap-2">
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary flex-1 ${mode === "targets" ? "is-selected" : ""}`}
                onClick={() => {
                  setMode("targets");
                  setKeyword("");
                  setSelectedIds([]);
                  setSelectedIdToName(new Map());
                }}
                aria-pressed={mode === "targets"}
              >
                예약 대상자
              </button>
              <button
                type="button"
                className={`ds-choice-btn ds-choice-btn--primary flex-1 ${mode === "students" ? "is-selected" : ""}`}
                onClick={() => {
                  setMode("students");
                  setKeyword("");
                  setSelectedIds([]);
                  setSelectedIdToName(new Map());
                }}
                aria-pressed={mode === "students"}
              >
                전체 학생
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                {mode === "targets" ? "예약 대상자 명단" : "전체 학생 명단"}
              </span>
              {selectedIds.length > 0 && (
                <span className="text-[13px] font-semibold text-[var(--color-brand-primary)]">
                  {selectedIds.length}명 선택됨
                </span>
              )}
            </div>

            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={mode === "students" ? "학생 검색 (2글자 이상)" : "대상자 내 검색"}
              allowClear
              className="ds-input w-full text-sm"
              aria-label={mode === "students" ? "학생 검색" : "대상자 검색"}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-[var(--color-text-secondary)]">
                선택된 {selectedIds.length}명 / 전체 {rows.length}명
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={toggleAll}
                  disabled={isLoading || rows.length === 0}
                >
                  현재 목록 전체 선택
                </Button>
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedIds([]);
                    setSelectedIdToName(new Map());
                  }}
                  disabled={selectedIds.length === 0}
                >
                  전체 해제
                </Button>
              </div>
            </div>

            <div
              className="rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
              style={{
                borderColor: "var(--color-border-divider)",
                background: "var(--color-bg-surface)",
              }}
            >
              <div className="shrink-0 modal-inner-table overflow-auto flex-1 min-h-0">
                {isLoading ? (
                  <EmptyState
                    mode="embedded"
                    scope="panel"
                    tone="loading"
                    title="불러오는 중…"
                  />
                ) : (
                  <table
                    className="w-full border-collapse"
                    style={{ tableLayout: "fixed" }}
                    role="grid"
                    aria-label={mode === "targets" ? "예약 대상자 명단" : "전체 학생 명단"}
                  >
                    <colgroup>
                      <col style={{ width: TABLE_COL.checkbox }} />
                      <col style={{ width: TABLE_COL.nameCompactModal }} />
                    </colgroup>
                    <thead>
                      <tr
                        className="sticky top-0 z-10"
                        style={{ background: "var(--color-bg-surface)" }}
                      >
                        <th
                          className="modal-inner-table__checkbox-cell border-b py-1.5 pl-2 pr-1 text-left text-[var(--color-text-muted)]"
                          style={{ borderColor: "var(--color-border-divider)" }}
                        >
                          <input
                            type="checkbox"
                            checked={allChecked}
                            disabled={isLoading || rows.length === 0}
                            onChange={toggleAll}
                            aria-label="현재 목록 전체 선택"
                          />
                        </th>
                        <th
                          className="modal-inner-table__name-th border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                          style={{ borderColor: "var(--color-border-divider)" }}
                        >
                          이름
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="py-5 px-3 text-center text-[var(--color-text-muted)]"
                          >
                            {keyword.trim()
                              ? "검색 결과 없음. 검색어를 바꿔 보세요."
                              : "표시할 대상이 없습니다."}
                          </td>
                        </tr>
                      ) : (
                        rows.map((r: TargetRow | StudentRow) => {
                          const id = mode === "targets" ? (r as TargetRow).enrollment_id : (r as StudentRow).id;
                          const name = mode === "targets" ? (r as TargetRow).student_name : (r as StudentRow).name;
                          const checked = selectedIds.includes(id);
                          return (
                            <tr
                              key={id}
                              className={`border-b ${checked ? "bg-[var(--color-bg-surface-soft)]" : ""}`}
                              style={{ borderColor: "var(--color-border-divider)" }}
                            >
                              <td
                                className="modal-inner-table__checkbox-cell py-1.5 pl-2 pr-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isLoading}
                                  onChange={(e) => toggleOne(id, e.target.checked)}
                                  aria-label={`${name} 선택`}
                                />
                              </td>
                              <td className="modal-inner-table__name py-1.5 px-3 text-[var(--color-text-primary)] truncate font-medium">
                                {name || "(이름 없음)"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* 우측: 선택 목록 */}
          <div
            className="flex flex-col gap-4 rounded-xl border p-4 w-[220px] shrink-0 self-stretch min-h-0 overflow-hidden"
            style={{
              borderColor: "var(--color-border-divider)",
              background: "var(--color-bg-surface)",
            }}
          >
            <section className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0 pl-0.5">
                <span
                  className="text-[13px] font-semibold"
                  style={{
                    color:
                      selectedIds.length > 0
                        ? "var(--color-brand-primary)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {selectedIds.length}명 선택됨
                </span>
                <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedIds([]);
                    setSelectedIdToName(new Map());
                  }}
                  disabled={selectedIds.length === 0}
                  className="!text-[13px]"
                >
                  전체 해제
                </Button>
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border p-2 max-h-[310px]"
                style={{
                  borderColor: "var(--color-border-divider)",
                  background: "var(--color-bg-surface-soft)",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {selectedRowsForDisplay.length === 0 ? (
                  <p className="text-[13px] text-[var(--color-text-muted)] py-4 text-center">
                    선택한 대상이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-0">
                    {selectedRowsForDisplay.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-[var(--color-bg-surface)] group min-h-[32px]"
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1 truncate text-[13px] font-semibold leading-6 text-[var(--color-text-primary)]">
                          {r.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSelected(r.id)}
                          disabled={isLoading}
                          className="shrink-0 p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] transition-colors disabled:opacity-50"
                          aria-label={`${r.name} 선택 해제`}
                          title="선택 해제"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} className="text-[13px]">
              취소
            </Button>
            <Button
              intent="primary"
              className="text-[13px]"
              onClick={handleConfirm}
              title={selectedIds.length === 0 ? "대상을 선택하거나 취소하세요." : undefined}
            >
              선택 확정 ({selectedIds.length}명)
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
