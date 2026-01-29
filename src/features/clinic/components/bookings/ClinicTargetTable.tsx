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
        r.student_name.includes(q) ||
        String(r.enrollment_id).includes(q)
    );
  }, [data, q]);

  const allChecked =
    rows.length > 0 &&
    rows.every((r) => selected.includes(r.enrollment_id));

  return (
    <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)]">
        <div className="text-sm font-semibold">예약 대상자</div>
        <Input
          placeholder="학생명 / enrollment_id 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-2 bg-[var(--bg-surface)]"
        />
      </div>

      <div className="px-5 py-3 flex items-center justify-between text-xs">
        <Checkbox
          checked={allChecked}
          onChange={() =>
            onChangeSelected(
              allChecked ? [] : rows.map((r) => r.enrollment_id)
            )
          }
        >
          전체 선택
        </Checkbox>
        <span>선택 {selected.length}명</span>
      </div>

      <div className="max-h-[560px] overflow-auto">
        {rows.map((r) => (
          <label
            key={r.enrollment_id}
            className="flex items-center gap-3 px-5 py-3 border-t text-sm hover:bg-[var(--bg-surface-soft)]"
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

            <div className="flex-1">
              <div className="font-semibold">{r.student_name}</div>
              <div className="text-xs text-[var(--text-muted)]">
                enrollment_id: {r.enrollment_id}
              </div>
            </div>

            {r.clinic_reason && (
              <Tag color={r.clinic_reason === "both" ? "red" : "orange"}>
                {r.clinic_reason}
              </Tag>
            )}
          </label>
        ))}

        {!isLoading && rows.length === 0 && (
          <div className="py-10 text-center text-xs text-[var(--text-muted)]">
            대상자가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
