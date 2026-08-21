/**
 * 시험과 과제가 함께 사용하는 대상자 편집기.
 * API와 편집 상태는 각 도메인 패널이 소유한다.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EnrollmentRow } from "./types";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Badge, Button, EmptyState } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { TABLE_COL } from "@/shared/ui/domain";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { formatPhone } from "@/shared/utils/formatPhone";
import { compareKoreanText } from "@/shared/utils/dataOrdering";
import "./EnrollmentManageModal.css";

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
  onRetry?: () => void;

  selectedIds: Set<number>;
  originSelectedIds?: ReadonlySet<number>;
  onToggle?: (id: number) => void;
  onSetSelectedIds?: (next: Set<number>) => void;

  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;

  /** 변경 여부(저장 버튼 활성화·푸터 문구) */
  dirty?: boolean;
};

export default function EnrollmentManageModal({
  open,
  onClose,
  title,
  description,
  rows,
  loading,
  error,
  onRetry,
  selectedIds,
  originSelectedIds,
  onToggle,
  onSetSelectedIds,
  onSave,
  saving,
  saveDisabled = false,
  dirty = true,
}: Props) {
  const confirm = useConfirm();
  const [keyword, setKeyword] = useState("");
  const [nameOrdering, setNameOrdering] = useState<"name" | "-name">("name");

  useEffect(() => {
    if (!open) {
      setKeyword("");
      setNameOrdering("name");
    }
  }, [open]);

  const safeClose = useCallback(async () => {
    if (saving) return;
    if (!dirty) {
      onClose();
      return;
    }
    const ok = await confirm({
      title: "변경사항 버리기",
      message: "변경사항이 있습니다.\n저장하지 않고 닫을까요?",
      danger: true,
      confirmText: "버리고 닫기",
    });
    if (ok) onClose();
  }, [saving, dirty, onClose, confirm]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const kDigits = k.replace(/\D/g, ""); // 전화번호 검색용 숫자만
    const matches = !k ? [...rows] : rows.filter((r) => {
      if ((r.student_name ?? "").toLowerCase().includes(k)) return true;
      // 전화번호: 입력값의 숫자만 추출해서 raw 전화번호와 매칭
      if (kDigits && (r.parent_phone ?? "").replace(/\D/g, "").includes(kDigits)) return true;
      if (kDigits && (r.student_phone ?? "").replace(/\D/g, "").includes(kDigits)) return true;
      if ((r.school ?? "").toLowerCase().includes(k)) return true;
      if (r.grade != null && `${r.grade}학년`.includes(k)) return true;
      return false;
    });
    return matches.sort((left, right) => {
      const compared = compareKoreanText(left.student_name, right.student_name);
      return (nameOrdering === "name" ? compared : -compared)
        || left.enrollment_id - right.enrollment_id;
    });
  }, [rows, keyword, nameOrdering]);

  const selectedRows = useMemo(
    () => rows
      .filter((r) => selectedIds.has(r.enrollment_id))
      .sort((left, right) => compareKoreanText(left.student_name, right.student_name)
        || left.enrollment_id - right.enrollment_id),
    [rows, selectedIds]
  );
  const addedCount = useMemo(() => {
    if (!originSelectedIds) return 0;
    let count = 0;
    selectedIds.forEach((id) => {
      if (!originSelectedIds.has(id)) count += 1;
    });
    return count;
  }, [originSelectedIds, selectedIds]);
  const removedCount = useMemo(() => {
    if (!originSelectedIds) return 0;
    let count = 0;
    originSelectedIds.forEach((id) => {
      if (!selectedIds.has(id)) count += 1;
    });
    return count;
  }, [originSelectedIds, selectedIds]);
  const originCount = originSelectedIds?.size ?? selectedIds.size;

  const readOnly = !onSave;

  if (!open) return null;

  const canInteract = !loading && !saving;
  const canSave = !readOnly && dirty && !loading && !saving && !saveDisabled;

  const selectAll = () => {
    if (!canInteract || readOnly || !onSetSelectedIds) return;
    const next = new Set(selectedIds);
    filtered.forEach((r) => next.add(r.enrollment_id));
    onSetSelectedIds(next);
  };

  const clearAll = () => {
    if (!canInteract || readOnly || !onSetSelectedIds) return;
    const next = new Set(selectedIds);
    filtered.forEach((r) => next.delete(r.enrollment_id));
    onSetSelectedIds(next);
  };

  const removeSelected = (enrollmentId: number) => {
    if (onSetSelectedIds) {
      onSetSelectedIds(new Set([...selectedIds].filter((existingId) => existingId !== enrollmentId)));
    } else {
      onToggle?.(enrollmentId);
    }
  };

  return (
    <AdminModal open={true} onClose={safeClose} type="action" width={960}>
      <ModalHeader
        type="action"
        title={title}
        description={description ?? "현재 차시에 등록된 수강생 중 이 평가에 참여할 학생을 선택합니다."}
      />

      <ModalBody>
        <div
          className="enrollment-manage-modal__layout grid gap-4 min-h-0 overflow-hidden ds-split-layout"
        >
          {/* 좌측: 검색 + 툴바 + 테이블 (차시 수강생 등록 모달과 동일) */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="enrollment-manage-modal__toolbar flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="enrollment-manage-modal__count"
                >
                  총 {rows.length}명
                </span>
                <div className="enrollment-manage-modal__search-wrap flex items-center gap-2 flex-1 min-w-0">
                  <input
                    className="enrollment-manage-modal__search-input ds-input flex-1 min-w-0"
                    placeholder="이름 / 전화번호 / 학교명 / 학년(예: 3학년)"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    disabled={!canInteract}
                    aria-label="학생 이름 검색"
                  />
                  <select
                    className="ds-input h-9 w-[132px] shrink-0 text-sm"
                    value={nameOrdering}
                    onChange={(event) => setNameOrdering(event.target.value as "name" | "-name")}
                    disabled={!canInteract}
                    aria-label="학생 이름 정렬"
                  >
                    <option value="name">이름 가나다순</option>
                    <option value="-name">이름 역순</option>
                  </select>
                </div>
              </div>
              {!readOnly && filtered.length > 0 && (
                <div className="enrollment-manage-modal__bulk-actions flex flex-wrap items-center gap-2">
                  <Button intent="secondary" size="sm" onClick={selectAll} disabled={!canInteract}>
                    검색 결과 전체 선택
                  </Button>
                  <Button intent="ghost" size="sm" onClick={clearAll} disabled={!canInteract}>
                    검색 결과 해제
                  </Button>
                </div>
              )}
            </div>

            {error && (
              <div
                className="enrollment-manage-modal__error flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <span>{error}</span>
                {onRetry && (
                  <Button intent="secondary" size="sm" onClick={onRetry} disabled={loading || saving}>
                    다시 불러오기
                  </Button>
                )}
              </div>
            )}

            <div
              className="enrollment-manage-modal__table-panel rounded-xl border overflow-hidden flex flex-col flex-1 min-h-0"
            >
              <div className="modal-inner-table overflow-auto flex-1 min-h-0">
                {loading ? (
                  <EmptyState
                    mode="embedded"
                    scope="panel"
                    tone="loading"
                    title="불러오는 중…"
                  />
                ) : (
                  <table
                    className="enrollment-manage-modal__table w-full border-collapse"
                    role="grid"
                    aria-label="전체 학생 명단"
                  >
                    <colgroup>
                      <col width={TABLE_COL.checkbox} />
                      <col width={TABLE_COL.nameCompactModal} />
                      <col width={TABLE_COL.phoneCompact} />
                      <col width={TABLE_COL.phoneCompact} />
                      <col width={TABLE_COL.mediumModal} />
                      <col width={TABLE_COL.shortModal} />
                    </colgroup>
                    <thead>
                      <tr
                        className="enrollment-manage-modal__header-row sticky top-0 z-10"
                      >
                        <th
                          className="enrollment-manage-modal__header-cell modal-inner-table__checkbox-cell border-b py-1.5 pl-2 pr-1 text-left text-[var(--color-text-muted)]"
                        >
                          {!readOnly && (
                            <input
                              type="checkbox"
                              checked={
                                filtered.length > 0 &&
                                filtered.every((r) =>
                                  selectedIds.has(r.enrollment_id)
                                )
                              }
                              disabled={!canInteract || filtered.length === 0}
                              onChange={() => {
                                if (
                                  filtered.every((r) =>
                                    selectedIds.has(r.enrollment_id)
                                  )
                                )
                                  clearAll();
                                else selectAll();
                              }}
                              aria-label="전체 선택 (검색·필터 결과 전체)"
                            />
                          )}
                        </th>
                        <th
                          className="enrollment-manage-modal__header-cell modal-inner-table__name-th border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                        >
                          이름
                        </th>
                        <th
                          className="enrollment-manage-modal__header-cell border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                        >
                          부모님 전화
                        </th>
                        <th
                          className="enrollment-manage-modal__header-cell border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                        >
                          학생 전화
                        </th>
                        <th
                          className="enrollment-manage-modal__header-cell border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
                        >
                          학교
                        </th>
                        <th
                          className="enrollment-manage-modal__header-cell border-b py-1.5 px-3 text-left text-[var(--color-text-muted)]"
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
                            {keyword.trim()
                              ? "검색 결과 없음. 검색어·필터를 바꿔 보세요."
                              : "표시할 학생이 없습니다."}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((r) => {
                          const checked = selectedIds.has(r.enrollment_id);
                          return (
                            <tr
                              key={r.enrollment_id}
                              className={`enrollment-manage-modal__row border-b ${checked ? "bg-[var(--color-bg-surface-soft)]" : ""}`}
                            >
                              <td
                                className="modal-inner-table__checkbox-cell py-1.5 pl-2 pr-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {!readOnly && (
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!canInteract}
                                    onChange={() =>
                                      onToggle?.(r.enrollment_id)
                                    }
                                    aria-label={`${r.student_name ?? ""} 선택`}
                                  />
                                )}
                              </td>
                              <td className="modal-inner-table__name py-1.5 px-3 text-[var(--color-text-primary)] truncate font-medium leading-6">
                                <button
                                  type="button"
                                  className="enrollment-manage-modal__name-button"
                                  disabled={!canInteract || readOnly}
                                  aria-label={`${r.student_name || "이름 없음"} 이름으로 ${checked ? "선택 해제" : "선택"}`}
                                  aria-pressed={checked}
                                  onClick={() => onToggle?.(r.enrollment_id)}
                                >
                                  <StudentNameWithLectureChip
                                    name={r.student_name || "(이름 없음)"}
                                    profilePhotoUrl={r.profile_photo_url ?? undefined}
                                    avatarSize={20}
                                    lectures={r.lectures ?? undefined}
                                    chipSize={14}
                                  />
                                </button>
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">
                                {formatPhone(r.parent_phone)}
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">
                                {formatPhone(r.student_phone)}
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] truncate leading-6">
                                {r.school || "-"}
                              </td>
                              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] leading-6">
                                {r.grade != null ? `${r.grade}학년` : "-"}
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
                  className="enrollment-manage-modal__table-footer flex items-center justify-between gap-3 py-2.5 px-3 border-t shrink-0 bg-[var(--color-bg-surface)]"
                >
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    총 {rows.length}명
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 변경 요약 + 최종 대상 목록 */}
          <div
            className="enrollment-manage-modal__selected-panel flex flex-col gap-4 rounded-xl border p-4 w-[220px] shrink-0 self-stretch min-h-0 overflow-hidden"
          >
            <section className="enrollment-manage-modal__change-summary" aria-label="대상자 변경 요약">
              <span className="enrollment-manage-modal__summary-label">변경 요약</span>
              <dl className="enrollment-manage-modal__summary-grid">
                <div>
                  <dt>기존</dt>
                  <dd>{originCount}명</dd>
                </div>
                <div>
                  <dt>추가</dt>
                  <dd><Badge tone="success" size="sm">+{addedCount}</Badge></dd>
                </div>
                <div>
                  <dt>제외</dt>
                  <dd><Badge tone={removedCount > 0 ? "warning" : "neutral"} size="sm">-{removedCount}</Badge></dd>
                </div>
                <div data-final="true">
                  <dt>저장 후</dt>
                  <dd>{selectedIds.size}명</dd>
                </div>
              </dl>
            </section>
            <section className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0 pl-0.5">
                <span
                  className="enrollment-manage-modal__selected-count text-[13px] font-semibold"
                  data-selected={selectedIds.size > 0 ? "true" : "false"}
                >
                  최종 대상 {selectedIds.size}명
                </span>
                <span className="text-[var(--color-border-divider)]" aria-hidden>|</span>
                {!readOnly && onSetSelectedIds && (
                  <Button
                    intent="secondary"
                    size="sm"
                    onClick={() => onSetSelectedIds(new Set())}
                    disabled={selectedIds.size === 0 || !canInteract}
                    className="!text-[13px]"
                  >
                    전체 해제
                  </Button>
                )}
              </div>
              <div
                className="enrollment-manage-modal__selected-list min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border p-2"
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
                        {!readOnly && (
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
                        )}
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
            <Button
              intent="secondary"
              onClick={safeClose}
              className="text-[13px]"
              disabled={saving}
            >
              취소
            </Button>
            {!readOnly && (
              <Button
                intent="primary"
                className="text-[13px]"
                onClick={onSave}
                disabled={!canSave}
                loading={saving}
                title={
                  !dirty
                    ? "변경사항이 없어서 저장할 수 없습니다."
                    : saveDisabled
                      ? "최신 명단을 불러온 뒤 저장할 수 있습니다."
                      : "저장"
                }
              >
                {saving ? "저장 중…" : `${selectedIds.size}명으로 저장`}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
