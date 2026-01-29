// PATH: src/features/homework/components/HomeworkEnrollmentManageModal.tsx
/**
 * HomeworkEnrollmentManageModal
 *
 * ✅ 과제 전용 대상 학생 관리 모달 (대기업 UX 개선 버전)
 *
 * 책임:
 * - homework_assignment 관리 UI
 * - enrollment 선택/해제
 *
 * UX 원칙:
 * - "저장 가능 상태"를 버튼/문구로 명확히 보여준다 (클릭했는데 무반응 금지)
 * - 변경사항 있을 때 닫기/오버레이/ESC는 confirm
 * - loading/saving 상태에서 상호작용 최소화
 *
 * ❌ 금지:
 * - 점수 / HomeworkScore / quick_patch
 * - 시험 / 성적 모달 재사용
 */

import { useEffect, useMemo, useState } from "react";
import type { EnrollmentRow } from "@/features/sessions/components/enrollment/types";

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

  /** ✅ Panel이 단일 진실로 계산해서 내려준다 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty, saving, loading]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      (r.student_name ?? "").toLowerCase().includes(k)
    );
  }, [rows, keyword]);

  if (!open) return null;

  const canInteract = !loading && !saving;
  const canSave = dirty && !loading && !saving;

  const safeClose = () => {
    if (saving) return; // 저장중 닫기 금지
    if (!dirty) {
      onClose();
      return;
    }
    const ok = window.confirm(
      "변경사항이 있습니다.\n저장하지 않고 닫을까요?"
    );
    if (ok) onClose();
  };

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => {
        // 오버레이 클릭 닫기 (카드 내부 클릭은 무시)
        if (e.target === e.currentTarget) safeClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-divider)] px-5 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-[var(--text-primary)]">
              {title}
            </div>
            {description && (
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {description}
              </div>
            )}
          </div>

          <button
            type="button"
            className={[
              "shrink-0 text-sm",
              saving ? "text-[var(--text-disabled)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            ].join(" ")}
            onClick={safeClose}
            disabled={saving}
          >
            닫기
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="학생 이름 검색"
              className="h-9 w-[240px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              disabled={!canInteract}
            />

            <div className="text-xs text-[var(--text-secondary)]">
              선택됨 <b>{selectedIds.size}</b>명 / 전체 {rows.length}명
              {loading && (
                <span className="ml-2 text-[var(--text-muted)]">불러오는 중...</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                disabled={!canInteract || filtered.length === 0}
                className="h-9 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm hover:bg-[var(--bg-surface-soft)] disabled:opacity-50"
              >
                현재 목록 전체 선택
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!canInteract || filtered.length === 0}
                className="h-9 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm hover:bg-[var(--bg-surface-soft)] disabled:opacity-50"
              >
                현재 목록 전체 해제
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}

          <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3 text-xs text-[var(--text-secondary)]">
            ⚠ 저장 버튼을 눌러야 서버에 실제 반영됩니다.
          </div>

          {/* Table */}
          <div className="max-h-[360px] overflow-auto rounded border border-[var(--border-divider)]">
            {loading ? (
              <div className="p-6 text-sm text-[var(--text-muted)]">
                불러오는 중...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-[var(--text-muted)]">
                표시할 학생이 없습니다.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left">선택</th>
                    <th className="px-3 py-2 text-left">학생</th>
                    <th className="px-3 py-2 text-left">enrollment_id</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const checked = selectedIds.has(r.enrollment_id);
                    return (
                      <tr
                        key={r.enrollment_id}
                        className="border-t border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canInteract}
                            onChange={() => onToggle(r.enrollment_id)}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                          {r.student_name || "(이름 없음)"}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">
                          {r.enrollment_id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-divider)] px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">
            {saving
              ? "저장 중... 잠시만 기다려주세요."
              : dirty
              ? "변경사항이 있습니다. 저장하면 확정됩니다."
              : "변경사항 없음"}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="h-9 rounded border border-[var(--border-divider)] px-4 text-sm hover:bg-[var(--bg-surface-soft)] disabled:opacity-50"
              onClick={safeClose}
              disabled={saving}
            >
              취소
            </button>

            <button
              type="button"
              className="h-9 rounded bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              onClick={onSave}
              disabled={!canSave}
              title={
                !dirty
                  ? "변경사항이 없어서 저장할 수 없습니다."
                  : loading
                  ? "로딩 중에는 저장할 수 없습니다."
                  : saving
                  ? "저장 중..."
                  : "저장"
              }
            >
              {saving ? "저장중..." : "선택 확정(저장)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
