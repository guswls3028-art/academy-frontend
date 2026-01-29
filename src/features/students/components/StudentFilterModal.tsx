// PATH: src/features/students/components/StudentFilterModal.tsx

import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: any;
  onApply: (next: any) => void;
}

export default function StudentFilterModal({
  open,
  onClose,
  filters,
  onApply,
}: Props) {
  const [local, setLocal] = useState<any>(filters || {});

  useEffect(() => {
    setLocal(filters || {});
  }, [filters]);

  if (!open) return null;

  function update(key: string, value: string) {
    setLocal((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }

  function apply() {
    onApply(local);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] rounded-xl bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-divider)] overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--border-divider)] px-5 py-4 bg-[var(--bg-surface-soft)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            고급 필터
          </h2>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            조건에 맞는 학생만 조회
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <input
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
            placeholder="학부모 전화번호"
            value={local.parent_phone || ""}
            onChange={(e) => update("parent_phone", e.target.value)}
          />

          <input
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
            placeholder="학생 전화번호"
            value={local.student_phone || ""}
            onChange={(e) => update("student_phone", e.target.value)}
          />

          <input
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
            placeholder="학교 이름"
            value={local.school || ""}
            onChange={(e) => update("school", e.target.value)}
          />

          <input
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
            placeholder="반"
            value={local.school_class || ""}
            onChange={(e) => update("school_class", e.target.value)}
          />

          <select
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
            value={local.gender || ""}
            onChange={(e) => update("gender", e.target.value)}
          >
            <option value="">성별 전체</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-divider)] bg-[var(--bg-surface)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md
              border border-[var(--border-divider)]
              text-[var(--text-secondary)]
              hover:bg-[var(--bg-surface-soft)]"
          >
            취소
          </button>

          <button
            onClick={apply}
            className="px-3 py-1.5 text-sm rounded-md
              bg-[var(--color-primary)]
              text-white
              hover:opacity-90"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
