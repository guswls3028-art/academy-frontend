// PATH: src/features/sessions/components/enrollment/EnrollmentManageModal.tsx
/**
 * EnrollmentManageModal (UI ONLY)
 *
 * ✅ HomeworkEnrollmentManageModal UX canonical 적용
 * - surface / token 기반
 * - API / state 관리 ❌
 */

import { useEffect, useMemo, useState } from "react";
import type { EnrollmentRow } from "./types";
import EnrollmentManageHeader from "./EnrollmentManageHeader";
import EnrollmentManageToolbar from "./EnrollmentManageToolbar";
import EnrollmentManageTable from "./EnrollmentManageTable";
import EnrollmentManageFooter from "./EnrollmentManageFooter";

type Props = {
  open: boolean;
  onClose: () => void;

  title: string;
  description?: string;

  sessionId: number;

  rows: EnrollmentRow[];
  loading?: boolean;
  error?: string | null;

  selectedIds: Set<number>;
  onToggle?: (id: number) => void;

  onSave?: () => void;
  saving?: boolean;

  onSetSelectedIds?: (next: Set<number>) => void;
};

export default function EnrollmentManageModal({
  open,
  onClose,
  title,
  description,
  sessionId,
  rows,
  loading,
  error,
  selectedIds,
  onToggle,
  onSave,
  saving,
  onSetSelectedIds,
}: Props) {
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!open) setKeyword("");
  }, [open]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      (r.student_name ?? "").toLowerCase().includes(k)
    );
  }, [rows, keyword]);

  const readOnly = !onSave;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-[var(--bg-surface)] shadow-lg">
        <EnrollmentManageHeader
          title={title}
          description={description}
          onClose={onClose}
        />

        <div className="space-y-4 px-5 py-4">
          <EnrollmentManageToolbar
            keyword={keyword}
            onKeywordChange={setKeyword}
            selectedCount={selectedIds.size}
            totalCount={rows.length}
            sessionId={sessionId}
            readOnly={readOnly}
            rows={filtered}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onSetSelected={onSetSelectedIds}
          />

          {error && (
            <div className="rounded border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}

          <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3 text-xs text-[var(--text-secondary)]">
            ⚠{" "}
            {readOnly
              ? "조회 전용 화면입니다."
              : "저장을 눌러야 서버에 실제 반영됩니다."}
          </div>

          <EnrollmentManageTable
            rows={filtered}
            loading={loading}
            error={error}
            selectedIds={selectedIds}
            onToggle={onToggle}
            readOnly={readOnly}
          />
        </div>

        <EnrollmentManageFooter
          readOnly={readOnly}
          onClose={onClose}
          onSave={onSave}
          saving={saving}
          dirty
        />
      </div>
    </div>
  );
}
