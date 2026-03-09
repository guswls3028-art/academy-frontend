// PATH: src/features/clinic/components/bookings/ClinicTargetTable.tsx
// 예약 대상자 목록 — 섹션형 SSOT

import { Checkbox, Input, Tag } from "antd";
import { useMemo, useState } from "react";
import { useClinicTargets } from "../../hooks/useClinicTargets";

export default function ClinicTargetTable({
  selected,
  onChangeSelected,
}: {
  selected: number[];
  onChangeSelected: (v: number[]) => void;
}) {
  const { data = [], isLoading } = useClinicTargets();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!q.trim()) return data;
    return data.filter(
      (r) =>
        r.student_name.includes(q) || String(r.enrollment_id).includes(q)
    );
  }, [data, q]);

  const allChecked =
    rows.length > 0 && rows.every((r) => selected.includes(r.enrollment_id));

  return (
    <div className="clinic-panel overflow-hidden flex flex-col min-h-0">
      <div className="clinic-panel__header">
        <h2 className="clinic-panel__title">예약 대상자</h2>
        <Input
          placeholder="이름·ID 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-3 bg-[var(--color-bg-surface)] border-[var(--color-border-divider)] rounded-lg"
        />
      </div>
      <div className="px-5 py-3 flex items-center justify-between text-xs border-t border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] shrink-0">
        <Checkbox
          checked={allChecked}
          onChange={() =>
            onChangeSelected(allChecked ? [] : rows.map((r) => r.enrollment_id))
          }
        >
          전체
        </Checkbox>
        <span className="text-[var(--color-text-muted)] font-semibold">
          {selected.length}명
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {rows.map((r) => (
          <label
            key={r.enrollment_id}
            className="ds-section__item flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border-divider)] last:border-b-0 cursor-pointer"
          >
            <Checkbox
              checked={selected.includes(r.enrollment_id)}
              onChange={(e) =>
                onChangeSelected(
                  e.target.checked
                    ? [...selected, r.enrollment_id]
                    : selected.filter((id) => id !== r.enrollment_id)
                )
              }
            />
            <div className="flex-1 min-w-0">
              <div className="ds-section__item-label truncate">
                {r.student_name}
              </div>
              <div className="ds-section__item-meta">ID {r.enrollment_id}</div>
            </div>
            {r.clinic_reason && (
              <Tag
                color={r.clinic_reason === "both" ? "red" : "orange"}
                className="shrink-0 text-[10px]"
              >
                {r.clinic_reason}
              </Tag>
            )}
          </label>
        ))}
        {!isLoading && rows.length === 0 && (
          <div className="ds-section__empty py-10">대상자가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
