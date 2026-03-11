// PATH: src/features/homework/components/HomeworkEnrollmentManageModal.tsx
/**
 * HomeworkEnrollmentManageModal
 *
 * ✅ 과제 전용 대상 학생 관리 모달
 * ✅ 차시 수강생 등록 모달(SessionEnrollModal)과 동일한 디자인·레이아웃 적용
 *
 * 책임:
 * - homework_assignment 관리 UI
 * - enrollment 선택/해제
 *
 * UX 원칙:
 * - "저장 가능 상태"를 버튼/문구로 명확히 보여준다 (클릭했는데 무반응 금지)
 * - 변경사항 있을 때 닫기/오버레이/ESC는 confirm
 * - loading/saving 상태에서 상호작용 최소화
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EnrollmentRow } from "@/features/sessions/components/enrollment/types";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { TABLE_COL } from "@/shared/ui/domain";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";

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

type Props = {
  open: boolean;
  onClose: () => void;

  title: string;
  description?: string;

  rows: EnrollmentRow[];
  loading?: boolean;
  error?: string | null;

  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onSetSelectedIds: (next: Set<number>) => void;

  onSave: () => void;
  saving?: boolean;

  dirty: boolean;
};

export default function HomeworkEnrollmentManageModal({
  open,
  onClose,
  title,
  description,
  rows,
  loading = false,
  error,
  selectedIds,
  onToggle,
  onSetSelectedIds,
  onSave,
  saving = false,
  dirty,
}: Props) {
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!open) setKeyword("");
  }, [open]);

  const safeClose = useCallback(() => {
    if (saving) return;
    if (!dirty) {
      onClose();
      return;
    }
    const ok = window.confirm(
      "변경사항이 있습니다.\n저장하지 않고 닫을까요?"
    );
    if (ok) onClose();
  }, [saving, dirty, onClose]);

  // ESC 닫기 + dirty confirm
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      safeClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, safeClose]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      (r.student_name ?? "").toLowerCase().includes(k)
    );
  }, [rows, keyword]);

  /** 선택된 행 목록 (우측 패널용, 학생명 표시) */
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.enrollment_id)),
    [rows, selectedIds]
  );

  if (!open) return null;

  const canInteract = !loading && !saving;
  const canSave = dirty && !loading && !saving;

  const selectAll = () => {
    if (!canInteract) return;
    const next = new Set(selectedIds);
    filtered.forEach((r) => next.add(r.enrollment_id));
    onSetSelectedIds(next);
  };

  const clearAll = () => {
    if (!canInteract) return;
    const next = new Set(selectedIds);
    filtered.forEach((r) => next.delete(r.enrollment_id));
    onSetSelectedIds(next);
  };

  const removeSelected = (enrollmentId: number) => {
    onSetSelectedIds(new Set([...selectedIds].filter((id) => id !== enrollmentId)));
  };

  return (
    <AdminModal open={true} onClose={safeClose} type="action" width={840}>
      <ModalHeader type="action" title={title} description={description} />

      <ModalBody>
        <div
          className="grid gap-4 min-h-0 overflow-hidden"
          style={{
            gridTemplateColumns: "1fr 220px",
            maxHeight: "min(78vh, 600px)",
            minHeight: 420,
          }}
        >
          {/* 좌측: 검색 + 툴바 + 테이블 */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3" style={{ marginBottom: 12 }}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    paddingRight: 12,
                    borderRight: "1px solid var(--color-border-divider)",
                    marginRight: 4,
                  }}
                >
                  총 {rows.length}명
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-0" style={{ maxWidth: 420 }}>
                  <input
                    className="ds-input flex-1 min-w-0"
                    placeholder="이름 / 전화번호 / 학교명 / 학년(예: 고1, 중2, 3학년)"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    style={{ maxWidth: 360 }}
                    disabled={!canInteract}
                    aria-label="학생 이름 검색"
                  />
                </div>
              </div>
              {selectedIds.size > 0 && (
                <span className="text-[13px] font-semibold text-[var(--color-brand-primary)]">
                  {selectedIds.size}명 선택됨
                </span>
              )}
            </div>

            {error && (
              <div
                className="rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-danger)",
                  background: "var(--color-danger-soft)",
                  color: "var(--color-danger)",
                }}
              >
                {error}
              </div>
            )}

            <div
              className="rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
              style={{
                borderColor: "var(--color-border-divider)",
                background: "var(--color-bg-surface)",
              }}
            >
              <div className="shrink-0 modal-inner-table overflow-auto flex-1 min-h-0">
                {loading ? (
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
                    aria-label="전체 학생 명단"
                  >
                    <colgroup>
                      <col style={{ width: TABLE_COL.checkbox }} />
                      <col style={{ width: TABLE_COL.nameCompactModal }} />
                      <col style={{ width: TABLE_COL.phoneCompact }} />
                      <col style={{ width: TABLE_COL.phoneCompact }} />
                      <col style={{ width: TABLE_COL.mediumModal }} />
                      <col style={{ width: TABLE_COL.shortModal }} />
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
                            checked={
                              filtered.length > 0 &&
                              filtered.every((r) => selectedIds.has(r.enrollment_id))
                            }
                            disabled={!canInteract || filtered.length === 0}
                            onChange={() => {
                              if (
                                filtered.every((r) => selectedIds.has(r.enrollment_id))
                              )
                                clearAll();
                              else
                                selectAll();
                            }}
                            aria-label="전체 선택 (검색·필터 결과 전체)"
                          />
                        </th>
                        <th
                          className="modal-inner-table__name-th border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                          style={{ borderColor: "var(--color-border-divider)" }}
                        >
                          이름
                        </th>
                        <th
                          className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                          style={{ borderColor: "var(--color-border-divider)" }}
                        >
                          부모님 전화
                        </th>
                        <th
                          className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                          style={{ borderColor: "var(--color-border-divider)" }}
                        >
                          학생 전화
                        </th>
                        <th
                          className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                          style={{ borderColor: "var(--color-border-divider)" }}
                        >
                          학교
                        </th>
                        <th
                          className="border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                          style={{ borderColor: "var(--color-border-divider)" }}
                        >
                          학년
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-5 px-3 text-center text-[var(--color-text-muted)]"
                          >
                            검색 결과 없음. 검색어·필터를 바꿔 보세요.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((r) => {
                          const checked = selectedIds.has(r.enrollment_id);
                          return (
                            <tr
                              key={r.enrollment_id}
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
                                  disabled={!canInteract}
                                  onChange={() => onToggle(r.enrollment_id)}
                                  aria-label={`${r.student_name ?? ""} 선택`}
                                />
                              </td>
                              <td className="modal-inner-table__name py-1.5 px-3 text-[var(--color-text-primary)] truncate cursor-pointer hover:bg-[var(--color-bg-surface-soft)] leading-6">
                                <StudentNameWithLectureChip
                                  name={r.student_name || "(이름 없음)"}
                                  profilePhotoUrl={r.profile_photo_url ?? undefined}
                                  avatarSize={20}
                                  lectures={r.lectures ?? undefined}
                                  chipSize={14}
                                />
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">
                                -
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">
                                -
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">
                                -
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] leading-6">
                                -
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 테이블 하단 총계 (차시 수강생 등록 모달과 동일) */}
              {(filtered.length > 0 || rows.length > 0) && (
                <div
                  className="flex items-center justify-between gap-3 py-2.5 px-3 border-t shrink-0 bg-[var(--color-bg-surface)]"
                  style={{ borderColor: "var(--color-border-divider)" }}
                >
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    총 {rows.length}명
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 선택 목록 (차시 수강생 등록 모달과 동일 구조) */}
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
                      selectedIds.size > 0
                        ? "var(--color-brand-primary)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {selectedIds.size}명 선택됨
                </span>
                <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => onSetSelectedIds(new Set())}
                  disabled={selectedIds.size === 0 || !canInteract}
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
                {selectedRows.length === 0 ? (
                  <p className="text-[13px] text-[var(--color-text-muted)] py-4 text-center">
                    선택한 학생이 없어요.
                    <span className="block mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                      왼쪽 테이블에서 체크 후 추가하세요.
                    </span>
                  </p>
                ) : (
                  <ul className="space-y-0">
                    {selectedRows.map((r) => (
                      <li
                        key={r.enrollment_id}
                        className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-[var(--color-bg-surface)] group min-h-[32px]"
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1 truncate">
                          <StudentNameWithLectureChip
                            name={r.student_name || "(이름 없음)"}
                            profilePhotoUrl={r.profile_photo_url ?? undefined}
                            avatarSize={20}
                            chipSize={14}
                            lectures={r.lectures ?? undefined}
                            className="text-[13px] font-semibold leading-6 text-[var(--color-text-primary)]"
                          />
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSelected(r.enrollment_id)}
                          disabled={!canInteract}
                          className="shrink-0 p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] transition-colors disabled:opacity-50"
                          aria-label={`${r.student_name ?? ""} 선택 해제`}
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
            <Button intent="secondary" onClick={safeClose} className="text-[13px]" disabled={saving}>
              취소
            </Button>
            <Button
              intent="primary"
              className="text-[13px]"
              onClick={onSave}
              disabled={!canSave}
              loading={saving}
              title={
                !dirty
                  ? "변경사항이 없어서 저장할 수 없습니다."
                  : "저장"
              }
            >
              {saving ? "저장 중…" : "선택 확정(저장)"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
